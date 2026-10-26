// Strona turnieju: GET /api/events/:slug/summary.
//
// Najdluzsza trasa w tym katalogu i nie bez powodu - sklada w jedna
// odpowiedz wszystko, co widok turnieju pokazuje naraz: stan turnieju,
// liczbe typujacych, konfiguracje faz, stan blokad typowania
// i postepy faz.
//
// is_archived idzie w odpowiedzi osobno od statusu, bo to nie to samo:
// trasa archiwum wydaje plik WYLACZNIE dla zarchiwizowanych, wiec
// turniej FINISHED, ale jeszcze nie zarchiwizowany, dostawalby
// przycisk konczacy sie bledem.
//
// Wydzielone z events.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerEventSummaryRoutes(
  app,
  {
    checkPickemGate,
    countParticipants,
    getEventPickemConfig,
    getOpenEventId,
    normalizePhase,
    pool,
  },
) {
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
          status,

          -- Widok eventu decyduje po tym, czy pokazać przycisk pobrania
          -- archiwum. Bez tego pola musiałby zgadywać po statusie, a to nie to
          -- samo: trasa archiwum wydaje plik wyłącznie dla zarchiwizowanych
          -- (patrz publicEvents.js), więc turniej FINISHED, ale jeszcze nie
          -- zarchiwizowany, dostałby przycisk kończący się błędem 409.
          is_archived
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
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
      // deadline'em - checkPickemGate sprawdza jedno i drugie, tak samo jak zapis.
      let typowanieOtwarte = false;

      // checkPickemGate pyta o AKTUALNIE OTWARTY event gildii, nie o ten z URL-a.
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

        const bramka = await checkPickemGate(
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
        code: "server.dbError",
      });
    }
  });
}
