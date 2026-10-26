// Rdzen API eventu: lista aktywnych, podsumowanie, mecze, ranking i zmiana
// statusu turnieju.
//
// Piec tras. Samo LICZENIE rankingu stoi w lib/leaderboardData.js - 864
// linie, ktore siedzialy w tym pliku wewnatrz wywolania
// createLeaderboardCache, jako funkcja strzalkowa. Z trasami nie mialy nic
// wspolnego: dostaja slug, oddaja gotowa liste.
//
// Tutaj zostaje to, co do trasy nalezy: wybor osi tabeli, stronicowanie
// i szukanie gracza - wszystko w JS, na liscie wzietej z pamieci podrecznej,
// zeby jeden przebieg obslugiwal wszystkie warianty parametrow.

import { createLeaderboardCache } from "../lib/leaderboardCache.js";
import { loadLeaderboardData } from "../lib/leaderboardData.js";

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
    checkPickemGate,
    pool,
    registerGuildRoutes,
    requireGuildAdmin,
    // Stawka za trafionego zwyciezce serii, z rules/scoring.js. Tak samo
    // jak w trasie profilu: trzecia os rankingu wycenia zarobione trafienia
    // ta sama liczba, co kafelek na profilu, zamiast miec wlasna kopie.
    scoring,
    buildMatchesWithPickSql,
    resolveMatchPredictionState,
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
      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
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
          code: "server.eventNotFound",
        });
      }

      // ============================================
      // MECZE
      // ============================================

      const [matches] = await pool.query(
        buildMatchesWithPickSql("m.event_id = ?"),
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
          resolveMatchPredictionState({
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
        code: "server.dbError",
      });
    }
  });

  /*
   * Policzony ranking trzymany w pamięci procesu - patrz lib/leaderboardCache.js.
   *
   * Zapamiętywana jest LISTA, a nie gotowa odpowiedź: stronicowanie
   * i szukanie dzieją się w JS, już po pobraniu wszystkiego, więc jeden
   * przebieg obsługuje wszystkie warianty parametrów.
   */
  const rankingi = createLeaderboardCache({
    load: (slug) =>
      loadLeaderboardData({ slug, pool, countParticipants, scoring }),
  });

  app.get("/api/events/:slug/leaderboard", async (req, res) => {
    try {
      const { slug } = req.params;
      const dane = await rankingi.get(slug);

      if (!dane) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      const { wszystkie, skutecznosc, zarobione, uczestnicy, meczow, tlum } =
        dane;

      // PORZĄDEK TABELI. Punkty rosną z każdym oddanym typem, więc ranking
      // punktowy w dużej mierze mierzy obecność - patrz komentarz
      // w server/lib/accuracyRanking.js. Druga oś układa tych samych ludzi
      // po odsetku trafień.
      //
      // Sortowanie i strony muszą dziać się w jednym miejscu: gdyby front
      // przesortował to, co dostał, ułożyłby tylko pięćdziesiąt widocznych
      // wierszy i „pierwszy w skuteczności" znaczyłoby „pierwszy na tej
      // stronie".
      const wybranyPorzadek = String(req.query.porzadek || "");

      const poSkutecznosci =
        wybranyPorzadek === "skutecznosc" && skutecznosc?.rows?.length > 0;

      // Trzecia oś. Ten sam warunek co wyżej: pusta tabela (turniej bez
      // rozstrzygniętych meczów albo same mecze oczywiste) nie przełącza
      // widoku, tylko zostawia porządek punktowy.
      const poZarobionych =
        wybranyPorzadek === "zarobione" && zarobione?.rows?.length > 0;

      const lista = poSkutecznosci
        ? skutecznosc.rows
        : poZarobionych
          ? zarobione.rows
          : wszystkie;


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
        ? lista.filter(
          (gracz) =>
            String(gracz.displayname || "").toLowerCase().includes(szukaj) ||
            String(gracz.user_id).includes(szukaj),
        )
        : lista;

      const stron = Math.max(1, Math.ceil(znalezione.length / naStronie));

      // ?znajdz=<userId> otwiera stronę, na której stoi ten gracz. Inaczej
      // przy 509 osobach trzeba by klikać "Następna" dziewięć razy, żeby
      // zobaczyć własne miejsce.
      const znajdz = String(req.query.znajdz || "").trim();

      let numer = Math.min(stron, Math.max(1, Number(req.query.strona) || 1));

      // Kogo szukano, a nie ma go w tej tabeli. Zdarza się tylko przy
      // skuteczności: kto nie dobił do progu, tego w niej nie ma, a
      // „Znajdź mnie" bez słowa wyjaśnienia wyglądałoby na zepsuty guzik.
      let pozaStawka = false;

      if (znajdz) {
        const pozycja = znalezione.findIndex(
          (gracz) => String(gracz.user_id) === znajdz,
        );

        if (pozycja >= 0) numer = Math.floor(pozycja / naStronie) + 1;
        else pozaStawka = true;
      }

      const leaderboard = znalezione.slice(
        (numer - 1) * naStronie,
        numer * naStronie,
      );

      // Ranking bierze sie z tabeli `leaderboard`, a ta zapelnia sie dopiero po
      // naliczeniu punktow. Dopoki nic nie jest rozliczone, lista jest pusta,
      // mimo ze gracze juz typuja - front musi umiec odroznic "nikt nie typowal"
      // od "typuja, ale nie ma jeszcze za co przyznac punktow".

      res.json({
        leaderboard,
        uczestnicy,
        meczow,

        // Poprzeczka dla liczb w tabeli. Idzie w kazdej odpowiedzi, takze
        // przy szukaniu i na dalszych stronach - jest wlasciwoscia turnieju,
        // a nie widocznego wycinka.
        tlum,

        // Jak ulozona jest ta tabela i czym jest stawka drugiej osi.
        // Same wiersze NIE ida - front dostaje je w `leaderboard`, juz
        // posortowane i pociete na strony; podwojenie listy tylko po to,
        // zeby dalo sie przelaczyc, byloby najciezsza rzecza w odpowiedzi.
        porzadek: poSkutecznosci
          ? "skutecznosc"
          : poZarobionych
            ? "zarobione"
            : "punkty",

        skutecznosc: {
          threshold: skutecznosc?.threshold ?? 0,
          players: skutecznosc?.players ?? 0,
        },

        // Stawka trzeciej osi. `obvious` z `matches` to cała jej treść:
        // bez nich "zarobione trafienia" jest liczbą bez skali, a z nimi
        // czyta się jako "z 106 meczów 39 trafiło ponad 85% pola".
        zarobione: {
          players: zarobione?.players ?? 0,
          matches: zarobione?.matches ?? 0,
          obvious: zarobione?.obvious ?? 0,
          threshold: zarobione?.threshold ?? 0,
          pointsPerHit: zarobione?.pointsPerHit ?? 0,
        },

        strony: {
          numer,
          naStronie,
          // `wszystkich` to wynik bieżącego filtra, `wRankingu` cała tabela -
          // front pokazuje "znaleziono X z Y", więc potrzebuje obu.
          wszystkich: znalezione.length,
          wRankingu: lista.length,
          ile: stron,
          szukano: szukaj || null,
          pozaStawka,
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
            code: "server.badStatus",
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
            code: "server.eventNotFound",
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
          code: "server.dbError",
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
