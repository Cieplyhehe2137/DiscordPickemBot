// Kiedy zgoda pola cokolwiek znaczy - jedyne zrodlo dwoch progow.
//
// SKAD SIE TU WZIELY. Obie liczby byly wpisane w server/lib/matchDifficulty.js
// i to on je opisal. Wyprowadzam je tutaj, bo potrzebuje ich takze BOT, a bot
// jest CommonJS i nie siegnie do modulu ESM z server/lib. Tak samo stoi
// rules/scoring.js: jeden plik, czytany po obu stronach we wlasnym formacie.
//
// Nie sa to progi punktowe, tylko progi WIARYGODNOSCI: mowia, kiedy odsetek
// policzony z typow pola w ogole o czyms swiadczy.

module.exports = {
  /**
   * Ponizej tylu glosow mecz nie jest klasyfikowany.
   *
   * Mecz z trzema typami pokazuje "100% trafilo" i nie znaczy to nic - trzy
   * osoby to nie jest pole. Ten sam prog, z tego samego powodu, stoi przy
   * niespodziankach (server/lib/upsets.js). Zmierzone: 155 ze 156 meczow
   * w bazie ma ich wiecej, wiec w praktyce nie odcina niczego.
   */
  MIN_VOTERS: 20,

  /**
   * Od ilu procent zgody pola mecz uznajemy za oczywisty.
   *
   * NIE jest lustrem cwiartki z niespodzianek i nie ma byc. Pole trafia
   * 58-65% zaleznie od fazy, wiec oba konce skali nie sa symetryczne -
   * odbicie progu 25% daloby 75%, a w to wpada 46% meczow i "oczywisty"
   * przestaje cokolwiek znaczyc. Histogram nie ma doliny, rosnie monotonicznie
   * od czterdziestu procent w gore, wiec prog jest decyzja, a nie odkryciem:
   * przy 85% zostaje 34% bazy.
   */
  OBVIOUS_PCT: 85,
};
