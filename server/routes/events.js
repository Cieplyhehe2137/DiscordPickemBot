// Rdzen API eventu: lista aktywnych, podsumowanie, mecze, ranking i zmiana
// statusu turnieju.
//
// Piec tras i ponad tysiac linii - siedzi tu miedzy innymi zapytanie
// rankingowe, ktore skleja nazwy graczy z osmiu tabel faz, bo user_profiles
// ma wiersz tylko dla osob logujacych sie na stronie. Kto typowal wylacznie
// z Discorda, ma tam nick tylko dzieki temu zlaczeniu.

export function registerEventRoutes(
  app,
  {
    countParticipants,
    VALID_PHASES,
    assertPredictionsAllowed,
    emitDashboardRefresh,
    findPanelForDeadline,
    findPanelForMatchDeadline,
    getEventPickemConfig,
    getOpenEventId,
    guildIdFromEventSlug,
    guildRegistry,
    hasAdminPermission,
    io,
    normalizePhase,
    parseDeadlineInput,
    pickemGate,
    pool,
    registerGuildRoutes,
    requireGuildAdmin,
    sqlMeczeZTypem,
    stanTypowaniaMeczu,
    teamsStore,
  },
) {
  app.get("/api/events/active", async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          e.id,
          e.name,
          e.slug,
          e.phase,
          e.status,

          (
            SELECT COUNT(DISTINCT mp.user_id)
            FROM match_predictions mp
            WHERE mp.event_id = e.id
          ) AS participants,

          (
            SELECT COUNT(*)
            FROM match_predictions mp
            WHERE mp.event_id = e.id
          ) AS predictions,

          (
            -- Panel należy wprost do eventu (migracja 0004). Wcześniej parowanie
            -- szło po guild_id + phase i dla Swiss nie trafiało nigdy:
            -- active_panels.phase trzyma 'swiss_stage1', a events.phase 'SWISS'.
            -- Dla pozostałych faz działało tylko dzięki temu, że utf8mb4_unicode_ci
            -- ignoruje wielkość liter ('PLAYOFFS' = 'playoffs') - stąd te CAST-y
            -- na kolację, teraz niepotrzebne.
            --
            -- Bez warunku na fazę, bo publisher gasi wszystkie panele gildii przy
            -- publikacji nowego, więc aktywny panel eventu jest dokładnie jeden.
            SELECT ap.deadline
            FROM active_panels ap
            WHERE ap.event_id = e.id
              AND ap.active = 1
              AND ap.deadline IS NOT NULL
            ORDER BY ap.deadline ASC
            LIMIT 1
          ) AS deadline

        FROM events e
        WHERE e.is_active = 1
          AND e.is_archived = 0
        ORDER BY e.id DESC
      `);

      res.json({
        events: rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  });

  // Ilu graczy w ogole wzielo udzial w evencie.
  //
  // Wczesniej liczyla to sama tabela match_predictions, wiec ktos, kto typowal
  // tylko druzyny (Swiss, Playoffs, Play-In, Double Elim), a nie typowal
  // meczow, nie liczyl sie jako uczestnik. Odkad typowanie druzyn jest osobnym
  // bytem podpietym do eventu, to juz nie jest przypadek brzegowy.
  //
  // CAST + COLLATE w kazdej galezi UNION, bo user_id ma rozne kolacje

  app.get("/api/events/:slug/summary", async (req, res) => {
    try {
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          phase,
          status
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      const [[matchStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total_matches
        FROM matches
        WHERE event_id = ?
        `,
        [event.id],
      );

      const [[predictionStats]] = await pool.query(
        `
        SELECT COUNT(*) AS predictions
        FROM match_predictions
        WHERE event_id = ?
        `,
        [event.id],
      );

      const uczestnicy = await countParticipants(event.id);

      const [[statusStats]] = await pool.query(
        `
    SELECT
      COUNT(*) AS total,

      SUM(
        mr.match_id IS NOT NULL
      ) AS finished_matches,

      SUM(
        mr.match_id IS NULL
        AND m.start_time_utc IS NOT NULL
        AND m.start_time_utc <= UTC_TIMESTAMP()
      ) AS live_matches,

  SUM(
    mr.match_id IS NULL
    AND m.is_locked = 1
    AND (
      m.start_time_utc IS NULL
      OR m.start_time_utc > UTC_TIMESTAMP()
    )
  ) AS locked_matches,

      SUM(
        mr.match_id IS NULL
        AND m.is_locked = 0
        AND (
          m.start_time_utc IS NULL
          OR m.start_time_utc > UTC_TIMESTAMP()
        )
      ) AS scheduled_matches

    FROM matches m

    LEFT JOIN match_results mr
      ON mr.match_id = m.id
     AND mr.event_id = m.event_id
     AND mr.guild_id = m.guild_id

    WHERE m.event_id = ?
    `,
        [event.id],
      );

      const [[nextMatch]] = await pool.query(
        `
    SELECT
      m.id,
      m.phase,
      m.team_a,
      m.team_b,
      m.best_of,
      m.start_time_utc,
      m.is_locked
    FROM matches m
    LEFT JOIN match_results mr
      ON mr.match_id = m.id
     AND mr.event_id = m.event_id
     AND mr.guild_id = m.guild_id
    WHERE m.event_id = ?
      AND m.start_time_utc IS NOT NULL
      AND m.start_time_utc >= UTC_TIMESTAMP()
      AND mr.match_id IS NULL
    ORDER BY m.start_time_utc ASC
    LIMIT 1
    `,
        [event.id],
      );

      const [phaseRows] = await pool.query(
        `
    SELECT DISTINCT phase
    FROM matches
    WHERE event_id = ?
      AND phase IS NOT NULL
    `,
        [event.id],
      );

      // Które fazy Pick'Em ten turniej FAKTYCZNIE ma.
      //
      // Strona eventu linkowała na sztywno wszystkie sześć (Swiss 1/2/3,
      // Play-In, Playoffs, Double Elim) niezależnie od formatu, więc turniej
      // bez Play-In i tak go pokazywał, a kliknięcie prowadziło na stronę
      // z komunikatem o niedostępności.
      //
      // active_panels nie nadaje się na źródło - nie ma event_id, jest per
      // gildia, a po zamknięciu panelu wiersz i tak przestaje być aktywny.
      // Bierzemy więc ślady w danych: mecze, typy graczy i wpisane wyniki.
      // Dzięki temu zakończony turniej nadal pokazuje swoje fazy.
      // Kto pyta - potrzebne, żeby powiedzieć "już wytypowałeś tę fazę".
      const userId = req.session?.user?.id || null;

      const [
        [swissStages],
        [pozostaleFazy],
        [swissZWynikiem],
        [inneZWynikiem],
        [swissMojeTypy],
        [inneMojeTypy],
      ] = await Promise.all([
        pool.query(
          `
          SELECT DISTINCT stage FROM swiss_predictions
           WHERE event_id = ? AND stage IS NOT NULL
          UNION
          SELECT DISTINCT stage FROM swiss_results
           WHERE event_id = ? AND stage IS NOT NULL
          `,
          [event.id, event.id],
        ),
        pool.query(
          `
          SELECT
            (SELECT COUNT(*) FROM playoffs_predictions WHERE event_id = ?)
          + (SELECT COUNT(*) FROM playoffs_results     WHERE event_id = ?) AS playoffs,
            (SELECT COUNT(*) FROM playin_predictions   WHERE event_id = ?)
          + (SELECT COUNT(*) FROM playin_results       WHERE event_id = ?) AS playin,
            (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ?)
          + (SELECT COUNT(*) FROM doubleelim_results     WHERE event_id = ?) AS doubleelim
          `,
          [event.id, event.id, event.id, event.id, event.id, event.id],
        ),

        // Które fazy mają już OPUBLIKOWANY oficjalny wynik (nie tylko typy).
        pool.query(
          `SELECT DISTINCT stage FROM swiss_results
            WHERE event_id = ? AND active = 1 AND stage IS NOT NULL`,
          [event.id],
        ),
        pool.query(
          `SELECT
             (SELECT COUNT(*) FROM playoffs_results   WHERE event_id = ? AND active = 1) AS playoffs,
             (SELECT COUNT(*) FROM playin_results     WHERE event_id = ? AND active = 1) AS playin,
             (SELECT COUNT(*) FROM doubleelim_results WHERE event_id = ? AND active = 1) AS doubleelim`,
          [event.id, event.id, event.id],
        ),

        // Czy pytający ma już zapisany typ w danej fazie.
        userId
          ? pool.query(
              `SELECT DISTINCT stage FROM swiss_predictions
                WHERE event_id = ? AND user_id = ? AND stage IS NOT NULL`,
              [event.id, userId],
            )
          : Promise.resolve([[]]),
        userId
          ? pool.query(
              `SELECT
                 (SELECT COUNT(*) FROM playoffs_predictions   WHERE event_id = ? AND user_id = ?) AS playoffs,
                 (SELECT COUNT(*) FROM playin_predictions     WHERE event_id = ? AND user_id = ?) AS playin,
                 (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ? AND user_id = ?) AS doubleelim`,
              [event.id, userId, event.id, userId, event.id, userId],
            )
          : Promise.resolve([[{}]]),
      ]);

      const fazyPickem = new Set();

      // Fazy wynikające z meczów (matches.phase -> klucz trasy frontu).
      for (const row of phaseRows) {
        const znormalizowana = normalizePhase(row.phase);

        // Starsze mecze mają fazę "SWISS" bez numeru etapu - z czasów sprzed
        // podziału na stage1/2/3. Traktujemy je jak Stage 1, bo tam trafiały
        // ich typy; inaczej stary turniej nie pokazałby żadnej fazy Swiss.
        if (znormalizowana === "SWISS") fazyPickem.add("stage1");

        if (znormalizowana === "SWISS_STAGE1") fazyPickem.add("stage1");
        if (znormalizowana === "SWISS_STAGE2") fazyPickem.add("stage2");
        if (znormalizowana === "SWISS_STAGE3") fazyPickem.add("stage3");
        if (znormalizowana === "PLAYOFFS") fazyPickem.add("playoffs");
        if (znormalizowana === "PLAYIN") fazyPickem.add("playin");
        if (znormalizowana === "DOUBLEELIM") fazyPickem.add("doubleelim");
      }

      for (const row of swissStages) {
        if (["stage1", "stage2", "stage3"].includes(row.stage)) {
          fazyPickem.add(row.stage);
        }
      }

      const liczniki = pozostaleFazy[0] || {};
      if (Number(liczniki.playoffs) > 0) fazyPickem.add("playoffs");
      if (Number(liczniki.playin) > 0) fazyPickem.add("playin");
      if (Number(liczniki.doubleelim) > 0) fazyPickem.add("doubleelim");

      // Faza, w której turniej jest teraz - nawet jeśli nikt jeszcze nie typował
      // i nie ma jeszcze meczów. Bez tego świeżo otwarta faza nie miałaby linku.
      const biezaca = normalizePhase(event.phase);
      const MAPA_BIEZACEJ = {
        SWISS_STAGE1: "stage1",
        SWISS_STAGE2: "stage2",
        SWISS_STAGE3: "stage3",
        PLAYOFFS: "playoffs",
        PLAYIN: "playin",
        DOUBLEELIM: "doubleelim",
      };
      if (MAPA_BIEZACEJ[biezaca]) fazyPickem.add(MAPA_BIEZACEJ[biezaca]);

      const KOLEJNOSC = [
        "stage1",
        "stage2",
        "stage3",
        "playin",
        "playoffs",
        "doubleelim",
      ];

      // Konfiguracja typowania DRUŻYN dla tego eventu.
      //
      // Gdy admin ją zapisał, ona decyduje o zestawie faz. Gdy nie (starsze
      // turnieje), zostaje wyznaczenie po śladach w danych - inaczej event
      // sprzed tej funkcji nagle nie miałby żadnej fazy.
      const konfiguracja = await getEventPickemConfig(pool, event.guild_id, event.id);

      if (konfiguracja.skonfigurowany) {
        fazyPickem.clear();

        for (const faza of KOLEJNOSC) {
          if (konfiguracja.fazy[faza]?.enabled) fazyPickem.add(faza);
        }
      }

      // Które fazy mają opublikowany wynik i w których pytający już typował.
      const zWynikiem = new Set(
        swissZWynikiem.map((r) => r.stage).filter(Boolean),
      );
      const licznikiWynikow = inneZWynikiem[0] || {};
      if (Number(licznikiWynikow.playoffs) > 0) zWynikiem.add("playoffs");
      if (Number(licznikiWynikow.playin) > 0) zWynikiem.add("playin");
      if (Number(licznikiWynikow.doubleelim) > 0) zWynikiem.add("doubleelim");

      const mojeTypy = new Set(swissMojeTypy.map((r) => r.stage).filter(Boolean));
      const licznikiTypow = inneMojeTypy[0] || {};
      if (Number(licznikiTypow.playoffs) > 0) mojeTypy.add("playoffs");
      if (Number(licznikiTypow.playin) > 0) mojeTypy.add("playin");
      if (Number(licznikiTypow.doubleelim) > 0) mojeTypy.add("doubleelim");

      const fazaAktywna = MAPA_BIEZACEJ[biezaca] || null;

      // Typowanie drużyn jest otwarte tylko w bieżącej fazie i tylko przed
      // deadline'em - pickemGate sprawdza jedno i drugie, tak samo jak zapis.
      let typowanieOtwarte = false;

      // pickemGate pyta o AKTUALNIE OTWARTY event gildii, nie o ten z URL-a.
      // Bez tego porównania zamknięty turniej, którego faza zgadza się z fazą
      // trwającego turnieju, raportował "typowanie otwarte" i front pokazywałby
      // na historycznym evencie przycisk "Typuj teraz".
      const otwartyEventId = await getOpenEventId(pool, event.guild_id);
      const toBiezacyEvent =
        otwartyEventId && Number(otwartyEventId) === Number(event.id);

      if (toBiezacyEvent && fazaAktywna && fazyPickem.has(fazaAktywna)) {
        const rodzaj = fazaAktywna.startsWith("stage")
          ? "SWISS"
          : fazaAktywna.toUpperCase();

        const bramka = await pickemGate(
          event.guild_id,
          rodzaj,
          fazaAktywna.startsWith("stage") ? fazaAktywna : null,
        );

        typowanieOtwarte = Boolean(bramka.allowed);
      }

      const fazyZeStatusem = KOLEJNOSC.filter((faza) => fazyPickem.has(faza)).map(
        (faza) => ({
          faza,
          aktywna: faza === fazaAktywna,
          // "otwarta" = da się teraz zapisać typ. Tylko bieżąca faza i tylko
          // przed deadline'em; reszta jest do oglądania.
          otwarta: faza === fazaAktywna && typowanieOtwarte,
          wynikOpublikowany: zWynikiem.has(faza),
          mamTyp: mojeTypy.has(faza),
          limity: konfiguracja.fazy[faza]?.limity || null,
        }),
      );

      res.json({
        event,
        stats: {
          participants: uczestnicy,
          predictions: predictionStats?.predictions || 0,
          matches: matchStats?.total_matches || 0,
        },
        match_status: {
          total: statusStats?.total || 0,
          live: statusStats?.live_matches || 0,
          finished: statusStats?.finished_matches || 0,
          locked: statusStats?.locked_matches || 0,
          scheduled: statusStats?.scheduled_matches || 0,
        },
        next_match: nextMatch || null,

        phase_info: {
          current: event.phase,
          status: event.status,
          available: phaseRows.map((row) => row.phase),

          // Klucze tras frontu (stage1 / playin / playoffs / doubleelim)
          // dla faz, które ten turniej realnie ma.
          pickem: KOLEJNOSC.filter((faza) => fazyPickem.has(faza)),
        },

        // Typowanie DRUŻYN - osobny byt od typowania meczów, przypisany
        // do tego eventu. Front używa tego, żeby prowadzić gracza do fazy,
        // w której faktycznie można teraz typować.
        pickem_druzyn: {
          skonfigurowany: konfiguracja.skonfigurowany,
          faza_aktywna: fazaAktywna,
          typowanie_otwarte: typowanieOtwarte,
          fazy: fazyZeStatusem,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  });

  app.get("/api/events/:slug/matches", async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = req.session?.user?.id || null;

      const [[event]] = await pool.query(
        `
        SELECT id, name, slug, guild_id
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      // ============================================
      // MECZE
      // ============================================

      const [matches] = await pool.query(
        sqlMeczeZTypem("m.event_id = ?"),
        [userId, userId, userId, event.id],
      );

      // ============================================
      // GLOBALNY GATE
      // ============================================

      const gate = await assertPredictionsAllowed({
        guildId: event.guild_id,
        kind: "MATCHES",
      });

      const deadlineCache = new Map();

      // ============================================
      // LOCK STATE
      // ============================================

      const matchesWithPredictionState = await Promise.all(
        matches.map((match) =>
          stanTypowaniaMeczu({
            match,
            gate,
            guildId: event.guild_id,
            deadlineCache,
          }),
        ),
      );

      // ============================================
      // PROGRESS PER FAZA
      // ============================================

      const progress = {};

      for (const match of matchesWithPredictionState) {
        const phase = match.phase || "other";

        if (!progress[phase]) {
          progress[phase] = {
            total: 0,
            complete: 0,
            partial: 0,
            empty: 0,
          };
        }

        progress[phase].total += 1;

        if (match.prediction_status === "complete") {
          progress[phase].complete += 1;
        } else if (match.prediction_status === "partial") {
          progress[phase].partial += 1;
        } else {
          progress[phase].empty += 1;
        }
      }

      // ============================================
      // RESPONSE
      // ============================================

      res.json({
        event,
        matches: matchesWithPredictionState,
        progress,
      });
    } catch (err) {
      console.error("EVENT MATCHES ERROR:", err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  });

  app.get("/api/events/:slug/leaderboard", async (req, res) => {
    try {
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
        SELECT id
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      // Klasyfikacja idzie z tabeli `leaderboard`, a nie z sumy match_points.
      //
      // Dwa powody. Po pierwsze `total_points` ma być tym samym, co pokazuje bot
      // i co ląduje w eksporcie klasyfikacji - wcześniej ten endpoint sumował
      // WYŁĄCZNIE punkty meczowe, więc strona "Ranking graczy" pomijała Swiss,
      // Playoffs, Play-In, Double Elim i MVP. Po drugie wiersze brały się z
      // `match_predictions`, przez co gracz, który typował tylko fazy Pick'Em,
      // a nie typował meczów, w ogóle nie pojawiał się w rankingu.
      //
      // Statystyki meczowe (skuteczność, trafieni zwycięzcy) zostają jako
      // uzupełnienie i są teraz doklejane LEFT JOIN-em, więc brak typów
      // meczowych daje zera zamiast wypadnięcia z listy.
      const [rows] = await pool.query(
        `
    SELECT
      lb.user_id,
      -- user_profiles ma wiersz tylko dla osób, które logowały się na stronie.
      -- Gracze typujący wyłącznie na Discordzie go nie mają, więc w rankingu
      -- zakończonego turnieju wychodziło im surowe user_id zamiast nicku.
      -- Ich nazwy leżą w tabelach faz, zapisane przy oddawaniu typu.
      COALESCE(up.displayname, up.username, nazwy.nazwa, lb.user_id) AS displayname,
      up.avatar,

      COALESCE(lb.total_points, 0) AS total_points,

      COALESCE(stats.total_predictions, 0) AS total_predictions,
      COALESCE(stats.correct_winners, 0) AS correct_winners,

      -- Rozbicie sumy na fazy. Wcześniej dawał je osobny endpoint
      -- /api/public/events/:slug/leaderboard, którego front nigdy nie wołał -
      -- utrzymywaliśmy dwa rankingi, z czego jeden martwy.
      COALESCE(fazy.swiss_points, 0) AS swiss_points,
      COALESCE(fazy.playoffs_points, 0) AS playoffs_points,
      COALESCE(fazy.playin_points, 0) AS playin_points,
      COALESCE(fazy.doubleelim_points, 0) AS doubleelim_points,
      COALESCE(fazy.match_points, 0) AS match_points,
      COALESCE(fazy.mvp_points, 0) AS mvp_points

    FROM leaderboard lb

    LEFT JOIN user_profiles up
      ON up.user_id COLLATE utf8mb4_unicode_ci
       = lb.user_id COLLATE utf8mb4_unicode_ci

    -- Nazwa zapamiętana przy typowaniu, z dowolnej fazy tego eventu.
    -- CAST + COLLATE musi objąć OBIE kolumny w KAŻDEJ gałęzi UNION - user_id
    -- i nazwę - bo kolacje różnią się między tabelami i inaczej leci
    -- ER_CANT_AGGREGATE_NCOLLATIONS.
    LEFT JOIN (
      SELECT user_id, MAX(nazwa) AS nazwa
      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS nazwa
          FROM swiss_predictions WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM swiss_scores WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_scores WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_scores WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_scores WHERE event_id = ? AND COALESCE(displayname, username) IS NOT NULL
      ) zrodla
      GROUP BY user_id
    ) nazwy
      ON nazwy.user_id
       = CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci

    LEFT JOIN (
      SELECT
        user_id,
        SUM(swiss_points) AS swiss_points,
        SUM(playoffs_points) AS playoffs_points,
        SUM(playin_points) AS playin_points,
        SUM(doubleelim_points) AS doubleelim_points,
        SUM(match_points) AS match_points,
        SUM(mvp_points) AS mvp_points
      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, COALESCE(points,0) swiss_points, 0 playoffs_points, 0 playin_points, 0 doubleelim_points, 0 match_points, 0 mvp_points
          FROM swiss_scores WHERE event_id = ?
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, COALESCE(points,0), 0, 0, 0, 0 FROM playoffs_scores WHERE event_id = ?
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, COALESCE(points,0), 0, 0, 0 FROM playin_scores WHERE event_id = ?
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, COALESCE(points,0), 0, 0 FROM doubleelim_scores WHERE event_id = ?
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, COALESCE(points,0), 0 FROM match_points WHERE event_id = ?
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, 0, COALESCE(points,0) FROM mvp_scores WHERE event_id = ?
      ) skladowe
      GROUP BY user_id
    ) fazy
      ON fazy.user_id = lb.user_id COLLATE utf8mb4_unicode_ci

    LEFT JOIN (
      SELECT
        mp.user_id,

        COUNT(DISTINCT mp.match_id) AS total_predictions,

        COUNT(
          DISTINCT CASE
            WHEN mr.match_id IS NOT NULL
             AND (
               (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
               OR
               (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
             )
            THEN mp.match_id
            ELSE NULL
          END
        ) AS correct_winners

      FROM match_predictions mp

      LEFT JOIN match_results mr
        ON mr.event_id = mp.event_id
       AND mr.match_id = mp.match_id

      WHERE mp.event_id = ?

      GROUP BY mp.user_id
    ) stats
      ON stats.user_id COLLATE utf8mb4_unicode_ci
       = lb.user_id COLLATE utf8mb4_unicode_ci

    WHERE lb.event_id = ?

    ORDER BY
      total_points DESC,
      correct_winners DESC,
      lb.user_id ASC
    `,
        [
          // nazwy z faz (8 tabel) - to zlaczenie stoi w SQL jako pierwsze
          event.id, event.id, event.id, event.id,
          event.id, event.id, event.id, event.id,
          // rozbicie punktow na fazy (6 tabel)
          event.id, event.id, event.id, event.id, event.id, event.id,
          // statystyki meczowe
          event.id,
          // WHERE lb.event_id
          event.id,
        ],
      );
      const [pointBreakdownRows] = await pool.query(
        `
    SELECT
      user_id,
      COALESCE(
        SUM(
          CASE
            WHEN source = 'series'
            THEN points
            ELSE 0
          END
        ),
        0
      ) AS series_points,

      COALESCE(
        SUM(
          CASE
            WHEN source = 'map'
            THEN points
            ELSE 0
          END
        ),
        0
      ) AS map_points

    FROM match_points

    WHERE event_id = ?

    GROUP BY user_id
    `,
        [event.id],
      );

      const pointBreakdownByUser = new Map(
        pointBreakdownRows.map((row) => [
          String(row.user_id),
          {
            series_points: Number(row.series_points || 0),
            map_points: Number(row.map_points || 0),
          },
        ]),
      );

      const [mapStatsRows] = await pool.query(
        `
    SELECT
      mmp.user_id,

      COUNT(*) AS predicted_maps,

      SUM(
        CASE
          WHEN mmr.match_id IS NOT NULL
           AND (
            (
              mmp.pred_exact_a > mmp.pred_exact_b
              AND mmr.exact_a > mmr.exact_b
            )
            OR
            (
              mmp.pred_exact_b > mmp.pred_exact_a
              AND mmr.exact_b > mmr.exact_a
            )
           )
          THEN 1
          ELSE 0
        END
      ) AS correct_maps,

      SUM(
        CASE
          WHEN mmr.match_id IS NOT NULL
           AND mmp.pred_exact_a = mmr.exact_a
           AND mmp.pred_exact_b = mmr.exact_b
          THEN 1
          ELSE 0
        END
      ) AS exact_maps

    FROM match_map_predictions mmp

    LEFT JOIN match_map_results mmr
      ON mmr.event_id = mmp.event_id
     AND mmr.match_id = mmp.match_id
     AND mmr.map_no = mmp.map_no

    WHERE mmp.event_id = ?

    GROUP BY mmp.user_id
    `,
        [event.id],
      );

      const mapStatsByUser = new Map(
        mapStatsRows.map((row) => [
          String(row.user_id),
          {
            predicted_maps: Number(row.predicted_maps || 0),
            correct_maps: Number(row.correct_maps || 0),
            exact_maps: Number(row.exact_maps || 0),
          },
        ]),
      );

      const leaderboardData = rows.map((row) => {
        const totalPredictions = Number(row.total_predictions || 0);
        const correctWinners = Number(row.correct_winners || 0);
        const pointBreakdown = pointBreakdownByUser.get(String(row.user_id)) || {
          series_points: 0,
          map_points: 0,
        };

        const mapStats = mapStatsByUser.get(String(row.user_id)) || {
          predicted_maps: 0,
          correct_maps: 0,
          exact_maps: 0,
        };

        return {
          user_id: row.user_id,
          displayname: row.displayname,
          avatar: row.avatar,

          total_points: Number(row.total_points || 0),

          // Rozbicie na serie/mapy bierze się z match_points (pointBreakdown),
          // bo główne zapytanie zwraca już tylko sumę końcową z `leaderboard`.
          series_points: pointBreakdown.series_points,
          map_points: pointBreakdown.map_points,

          // Rozbicie na fazy turnieju.
          swiss_points: Number(row.swiss_points || 0),
          playoffs_points: Number(row.playoffs_points || 0),
          playin_points: Number(row.playin_points || 0),
          doubleelim_points: Number(row.doubleelim_points || 0),
          phase_match_points: Number(row.match_points || 0),
          mvp_points: Number(row.mvp_points || 0),

          total_predictions: totalPredictions,
          correct_winners: correctWinners,

          predicted_maps: mapStats.predicted_maps,
          correct_maps: mapStats.correct_maps,
          exact_maps: mapStats.exact_maps,

          accuracy:
            totalPredictions > 0
              ? Math.round((correctWinners / totalPredictions) * 100)
              : 0,
        };
      });

      leaderboardData.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }

        if (b.correct_winners !== a.correct_winners) {
          return b.correct_winners - a.correct_winners;
        }

        if (b.correct_maps !== a.correct_maps) {
          return b.correct_maps - a.correct_maps;
        }

        if (b.exact_maps !== a.exact_maps) {
          return b.exact_maps - a.exact_maps;
        }

        return String(a.user_id).localeCompare(String(b.user_id));
      });

      // Miejsce liczymy PRZED podziałem na strony, bo o kolejności decyduje
      // sortowanie w JS (punkty, potem trafieni zwycięzcy, mapy, exacty),
      // a nie ORDER BY z zapytania - te dwa porządki rozstrzygają remisy
      // inaczej. Gdyby strony wycinał SQL, gracz na granicy potrafiłby
      // pojawić się dwa razy albo zniknąć.
      const wszystkie = leaderboardData.map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

      const NA_STRONIE_DOMYSLNIE = 50;
      const NA_STRONIE_MAKS = 200;

      const naStronie = Math.min(
        NA_STRONIE_MAKS,
        Math.max(1, Number(req.query.naStronie) || NA_STRONIE_DOMYSLNIE),
      );

      // Szukanie po nicku. Filtrujemy PEŁNĄ listę, nie bieżącą stronę - przy
      // 11 stronach szukanie tylko w widocznym wycinku byłoby bezużyteczne.
      // Miejsce (rank) jest już przypisane, więc wynik zachowuje pozycję
      // z pełnego rankingu, a nie numer w obrębie wyników wyszukiwania.
      const szukaj = String(req.query.szukaj || "").trim().toLowerCase();

      const znalezione = szukaj
        ? wszystkie.filter(
          (gracz) =>
            String(gracz.displayname || "").toLowerCase().includes(szukaj) ||
            String(gracz.user_id).includes(szukaj),
        )
        : wszystkie;

      const stron = Math.max(1, Math.ceil(znalezione.length / naStronie));

      // ?znajdz=<userId> otwiera stronę, na której stoi ten gracz. Inaczej
      // przy 509 osobach trzeba by klikać "Następna" dziewięć razy, żeby
      // zobaczyć własne miejsce.
      const znajdz = String(req.query.znajdz || "").trim();

      let numer = Math.min(stron, Math.max(1, Number(req.query.strona) || 1));

      if (znajdz) {
        const pozycja = znalezione.findIndex(
          (gracz) => String(gracz.user_id) === znajdz,
        );

        if (pozycja >= 0) numer = Math.floor(pozycja / naStronie) + 1;
      }

      const leaderboard = znalezione.slice(
        (numer - 1) * naStronie,
        numer * naStronie,
      );

      // Ranking bierze sie z tabeli `leaderboard`, a ta zapelnia sie dopiero po
      // naliczeniu punktow. Dopoki nic nie jest rozliczone, lista jest pusta,
      // mimo ze gracze juz typuja - front musi umiec odroznic "nikt nie typowal"
      // od "typuja, ale nie ma jeszcze za co przyznac punktow".
      const uczestnicy = await countParticipants(event.id);

      res.json({
        leaderboard,
        uczestnicy,
        strony: {
          numer,
          naStronie,
          // `wszystkich` to wynik bieżącego filtra, `wRankingu` cały ranking -
          // front pokazuje "znaleziono X z Y", więc potrzebuje obu.
          wszystkich: znalezione.length,
          wRankingu: wszystkie.length,
          ile: stron,
          szukano: szukaj || null,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  });


  app.post(
    "/api/events/:slug/status",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { status } = req.body;
        const { guildId } = req;

        // The UI sends OPEN / CLOSED / ARCHIVED. ARCHIVED is not a value of
        // the events.status enum ('UPCOMING','OPEN','CLOSED','FINISHED') -
        // archiving is stored as status FINISHED + is_archived = 1, matching
        // what the end-tournament endpoint writes.
        const STATUS_ACTIONS = {
          OPEN: { status: "OPEN", is_open: 1, is_active: 1, is_archived: 0 },
          CLOSED: { status: "CLOSED", is_open: 0, is_active: 1, is_archived: 0 },
          ARCHIVED: {
            status: "FINISHED",
            is_open: 0,
            is_active: 0,
            is_archived: 1,
          },
        };

        const action = STATUS_ACTIONS[String(status || "").toUpperCase()];

        if (!action) {
          return res.status(400).json({
            error: "Nieprawidłowy status.",
            allowedStatuses: Object.keys(STATUS_ACTIONS),
          });
        }

        const [result] = await pool.query(
          `
    UPDATE events
    SET
      status = ?,
      is_open = ?,
      is_active = ?,
      is_archived = ?
    WHERE guild_id = ?
      AND slug = ?
    LIMIT 1
    `,
          [
            action.status,
            action.is_open,
            action.is_active,
            action.is_archived,
            guildId,
            slug,
          ],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
          });
        }
        emitDashboardRefresh({
          slug,
          guildId,
          reason: "event_status_updated",
        });

        // Broadcast the status actually stored, not the requested action -
        // "ARCHIVED" is persisted as FINISHED + is_archived, so echoing the
        // raw input would leave every open client showing a status that
        // does not exist in the database.
        io.emit("event:status_updated", {
          slug,
          status: action.status,
          is_archived: action.is_archived,
        });

        res.json({
          ok: true,
          slug,
          status: action.status,
          is_archived: action.is_archived,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  // Trasy /api/guilds siedza w server/routes/guilds.js. Wywolanie stoi tam,
  // gdzie byly - kolejnosc rejestracji jest czescia zachowania.
  registerGuildRoutes(app, {
    pool,
    guildRegistry,
    teamsStore,
    requireGuildAdmin,
    hasAdminPermission,
    VALID_PHASES,
    parseDeadlineInput,
    findPanelForDeadline,
    findPanelForMatchDeadline,
  });
}
