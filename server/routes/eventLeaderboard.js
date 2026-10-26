// Ranking turnieju: GET /api/events/:slug/leaderboard.
//
// Trzy osie tej samej tabeli - punkty, skutecznosc i zarobione
// trafienia - plus stronicowanie i szukanie gracza. Wszystko w JS, na
// liscie policzonej raz, bo jeden przebieg obsluguje wtedy wszystkie
// warianty parametrow.
//
// SORTUJE SERWER, nie front: front dostaje jedna strone, wiec nie ma
// czego sortowac. Pilnuje tego test/leaderboardRoute.test.js.
//
// Samo liczenie siedzi w lib/leaderboardData.js, a pamiec podreczna
// w lib/leaderboardCache.js - tutaj zostaje odpowiedz HTTP.
//
// Wydzielone z events.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import { createLeaderboardCache } from "../lib/leaderboardCache.js";
import { loadLeaderboardData } from "../lib/leaderboardData.js";

export function registerEventLeaderboardRoutes(
  app,
  {
    countParticipants,
    pool,
    scoring,
  },
) {
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
}
