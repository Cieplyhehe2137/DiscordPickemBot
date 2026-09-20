// Regulaminy, które JUŻ NIE OBOWIĄZUJĄ.
//
// rules/scoring.js jest jedynym źródłem stawek NA DZIŚ i tak ma zostać. Ten
// plik odpowiada na inne pytanie: czym liczono turniej, który jest już
// zamknięty. Zarchiwizowanego turnieju nie przeliczamy - przeliczenie
// przepisałoby ranking, który ludzie widzieli jako ostateczny - więc punkty
// w bazie zostają takie, jakimi je naliczono.
//
// PO CO TO ISTNIEJE. Strona „Punktacja" pokazywała jedną tabelę i jeden
// przypis o zmianie zasad punktowania MAP. Zmiana stawek za SERIĘ była
// większa i nie było o niej ani słowa - a strona twierdziła wprost, że
// „dokładny wynik serii nie daje nic ponad to". W IEM Cologne Major 2026
// dawał czterokrotność.
//
// STAWKI SĄ ZREKONSTRUOWANE Z DANYCH, nie znalezione w historii zmian.
// Nie ma po nich commita ani wpisu - są wyprowadzone z tego, co naliczono
// w bazie, przez porównanie każdego typu z przyznanym punktem. To jest
// mocna rekonstrukcja, ale rekonstrukcja:
//
//   serie   zgadza się co do punktu na 6378 z 6424 typów  (99,3%)
//   mapy    zgadza się na 6224 z 6274 par gracz-mecz      (99,2%)
//
// Odstępstwa to wiersze przeliczone później już nową regułą - wszystkie 46
// wyjątków przy seriach ma dokładnie 2 punkty, czyli dzisiejszą stawkę.
//
// Dlatego tu, a nie w komponencie strony: ten sam komplet stawek stał już
// kiedyś w dwóch miejscach naraz i rozjechał się cicho (patrz nagłówek
// rules/scoring.js). Historia ma leżeć tam, gdzie teraźniejszość.

module.exports = [
  {
    id: "cologne-2026",

    // Turnieje rozliczone tym regulaminem.
    //
    // Slug prowadzi na stronę turnieju, nazwa stoi w zdaniu. Nazwa jest
    // TUTAJ, a nie dociagana z bazy, i to jest świadome: turniej z tej
    // listy jest zamknięty, więc jego nazwa już się nie zmieni, a pytanie
    // o nią kosztowałoby podróż do bazy na trasie, która dziś w ogóle
    // jej nie dotyka.
    events: [
      { slug: "iem-cologne-major-2026", name: "IEM Cologne Major 2026" },
    ],

    // Czym RÓŻNIŁ SIĘ od dzisiejszego. Tylko różnice - powtarzanie stawek,
    // które się nie zmieniły, kazałoby utrzymywać drugą pełną kopię tabeli
    // i to ona rozjechałaby się jako pierwsza.
    //
    // Kolejność ścieżek jest ta sama, co w web/src/lib/scoring.js, żeby
    // różnice dało się czytać obok bieżącej tabeli.
    changes: [
      {
        path: "MATCH.WINNER",

        // 4 pkt za trafionego zwycięzcę Z DOKŁADNYM wynikiem serii,
        // 1 pkt za samego zwycięzcę. Dzisiejsze 2 pkt nie zależy od wyniku.
        was: 4,
        alsoKey: "scoringHistory.cologne.seriesWinnerOnly",
        alsoValue: 1,
      },

      {
        path: "MAP.EXACT",

        // Mapa dawała punkty WYŁĄCZNIE za dokładny wynik. Odchylenie o rundę
        // czy dwie nie dawało nic, więc DIFF_1 i DIFF_2 jeszcze nie istniały.
        was: 3,
      },

      { path: "MAP.DIFF_1", was: 0 },
      { path: "MAP.DIFF_2", was: 0 },
    ],
  },
];
