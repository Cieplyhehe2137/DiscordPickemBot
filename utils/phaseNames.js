// Nazwa fazy sprowadzona do jednej postaci.
//
// Faza przychodzi z kilku miejsc i w kilku zapisach: z konfiguracji eventu,
// z kolumny w bazie, z adresu URL i z customId komponentu Discorda. 'playin',
// 'play_in' i 'PLAY-IN' to ta sama faza, a kluczowanie po surowej wartości
// rozjeżdżało mapy paneli.
//
// Osobny moduł, bo protectionsGuards.js - gdzie ta funkcja mieszkała -
// zaciąga przez logger winstona, a przez guildContext całe mysql2. Zadanie
// `testy` w CI chodzi bez `npm ci`, więc testu na tę funkcję nie dało się
// napisać inaczej niż przepisując ją do pliku testowego. Kopia zdążyła się
// już rozjechać z oryginałem: brakowało w niej aliasów playoffs, playin
// i doubleelim, a przechodziła tylko dlatego, że dla tych trzech wartości
// samo toUpperCase() daje przypadkiem ten sam wynik.
//
// Tutaj nie ma żadnego importu i nigdy nie powinno go być - to jest cena
// za to, żeby test ładował tę samą funkcję, którą wykonuje produkcja.

const ALIASES = {
  // SWISS
  swiss_stage_1: "SWISS_STAGE1",
  swiss_stage1: "SWISS_STAGE1",
  stage1: "SWISS_STAGE1",

  swiss_stage_2: "SWISS_STAGE2",
  swiss_stage2: "SWISS_STAGE2",
  stage2: "SWISS_STAGE2",

  swiss_stage_3: "SWISS_STAGE3",
  swiss_stage3: "SWISS_STAGE3",
  stage3: "SWISS_STAGE3",

  // PLAYOFFS
  playoffs: "PLAYOFFS",

  // PLAY-IN
  playin: "PLAYIN",
  play_in: "PLAYIN",

  // DOUBLE ELIM
  double: "DOUBLEELIM",
  doubleelim: "DOUBLEELIM",
  double_elim: "DOUBLEELIM",
  double_elimination: "DOUBLEELIM",

  // MATCHES
  matches: "MATCHES",
  match: "MATCHES",

  // Generic Swiss identifier.
  swiss: "SWISS",
};

// Dopasowanie idzie po TABLICY ALIASÓW, a nie wzorcem. Różnica jest widoczna:
// 'stage2' trafia na SWISS_STAGE2, a 'stage_2' nie ma wpisu i wychodzi z tego
// 'STAGE_2', które nie pasuje do niczego dalej.
function normalizePhase(phase) {
  const value = String(phase || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ALIASES[value] || value.toUpperCase();
}

module.exports = {
  ALIASES,
  normalizePhase,
};
