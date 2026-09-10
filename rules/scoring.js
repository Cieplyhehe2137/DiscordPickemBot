// Jedyne źródło stałych punktowych.
//
// Do tej pory tylko MATCH i MAP były stąd faktycznie czytane (przez
// utils/matchScoring.js). Wartości dla SWISS, PLAYOFFS, MVP, DOUBLE_ELIM
// i PLAY_IN były wpisane na sztywno w handlers/matches/calculateScores.js,
// i to INNE liczby niż tutaj: Swiss punktował 4/4/2 zamiast 3/3/1,
// a Playoffs 1/2/3/2 zamiast 2/3/5/2. Ten plik pokazywał więc regulamin,
// którego bot nie stosował.
//
// Poniższe wartości to te, które obowiązują naprawdę - calculateScores
// czyta je teraz stąd, więc jedna zmiana wystarcza i nie da się już
// rozjechać obu miejsc.
module.exports = {
  MATCH: {
    WINNER: 2,
  },

  MAP: {
    EXACT: 3,
    DIFF_1: 2,
    DIFF_2: 1,
    MISS: 0,
  },

  SWISS: {
    PICK_3_0: 4,
    PICK_0_3: 4,
    ADVANCING: 2,
  },

  PLAYOFFS: {
    SEMIFINALIST: 1,
    FINALIST: 2,
    WINNER: 3,
    THIRD_PLACE: 2,
  },

  MVP: {
    CORRECT: 5,
  },

  DOUBLE_ELIM: {
    CORRECT_PICK: 1,
  },

  PLAY_IN: {
    CORRECT_PICK: 1,
  },
};
