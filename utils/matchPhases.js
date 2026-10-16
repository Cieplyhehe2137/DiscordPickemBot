// utils/matchPhases.js
//
// Fazy meczu w selectach Discorda - jedna lista dla czterech paneli.
//
// Te same szesc opcji stalo wklejone osobno w openAddMatch, openClearMatches,
// openMatchResults i editMatchSelect. Kopie byly jednakowe, ale zadna nie
// wiedziala o pozostalych: faza dodana w jednym panelu dawalaby mecze,
// ktorych reszta nie widzi - nie dalo by sie ani wpisac im wyniku, ani ich
// wyczyscic.
//
// Stad bierze liste takze dwoch walidatorow przyjmujacych wybor z selecta
// edycji: editMatchPhase i editMatchModal. Gdyby zostaly przy swoich
// kopiach, faza dopisana tutaj bylaby do wybrania w panelu i odrzucana
// sekunde pozniej.
//
// Wartosci musza byc dokladnie tymi, ktore trafiaja do kolumny matches.phase.
//
// To NIE jest ta sama lista co VALID_PHASES z utils/deadlineRepository.js.
// Tamta trzyma 'swiss' bez etapow, bo deadline ustawia sie na calego Swissa
// naraz; uzycie jej tutaj odrzucaloby poprawne fazy meczow.
//
// handlers/admin/panelOpenMenu.js ma te same etykiety, ale przy INNYCH
// wartosciach ('results:swiss1'), bo to adresy akcji panelu, a nie fazy
// meczu. Osobny zestaw i zostaje osobny.
//
// handlers/admin/autoStartEventSelect.js ma te same szesc wartosci, a mimo
// to zostaje osobny: jego wybor sprawdza phasesConfig z
// utils/pickemPanelBuilder.js i stamtad ida jego etykiety. Faza dopisana
// tutaj bylaby tam do wyboru i odrzucona przy zapisie.
//
// Plik nie ma zadnego importu i nie powinien go miec - dzieki temu test
// laduje te sama liste, ktora wykonuje produkcja, bez zaciagania discord.js.

const MATCH_PHASE_OPTIONS = [
  { label: "Swiss — Stage 1", value: "swiss_stage1" },
  { label: "Swiss — Stage 2", value: "swiss_stage2" },
  { label: "Swiss — Stage 3", value: "swiss_stage3" },
  { label: "Playoffs", value: "playoffs" },
  { label: "Double Elim", value: "doubleelim" },
  { label: "Play-In", value: "playin" },
];

// Swieze kopie, a nie wspolna tablica. Buildery discord.js trzymaja podana
// opcje przez referencje, wiec trzy selecty na jednej tablicy dzielilyby te
// same obiekty - pozniejsze setDefault() na jednym panelu zmienialoby liste
// w dwoch pozostalych.
function matchPhaseOptions() {
  return MATCH_PHASE_OPTIONS.map((option) => ({ ...option }));
}

module.exports = { matchPhaseOptions };
