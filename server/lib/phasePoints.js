// Punkty gracza z FAZ turnieju, osobno od meczowych.
//
// Klasyfikacja eventu to suma sześciu składowych (services/rebuildEventLeaderboard.js):
// swiss_scores, playin_scores, playoffs_scores, doubleelim_scores, match_points
// i mvp_scores. Profil gracza czytał z tego wyłącznie ostatnie dwa - cała górna
// połowa strony liczyła mecze i tylko mecze.
//
// CO TO PSUŁO. Zmierzone na produkcji: z 1294 wpisów gracz-turniej 708 (55%)
// nie ma ANI JEDNEGO wiersza w match_points. Profil pokazywał im ścianę zer -
// „0.0 pkt / mecz", „Skuteczność 0% — 0 / 0 meczów", pusty wykres - obok
// prawdziwej sumy punktów w kafelku wyżej. Pierwsze miejsce w StarLadder
// Budapest 2025 ma 47 punktów i dostawało siedem kafelków z zerem.
//
//   turniej                    w tabeli   ze ścianą zer
//   StarLadder Budapest 2025        509             509   (zero meczów w bazie)
//   IEM Cologne Major 2026          523             148
//   IEM Kraków 2026                 262              51
//
// CZYSTY, BEZ IMPORTÓW - regułę da się sprawdzić bez bazy.

/**
 * Kolejność faz na osi czasu turnieju.
 *
 * Wynika z przebiegu, a nie z alfabetu ani z kolejności tabel w bazie:
 * najpierw kwalifikacje (Play-In), potem Swiss, potem drabinka. Double Elim
 * stoi przed Playoffs, bo tam, gdzie występuje, jest formatem grupowym przed
 * fazą pucharową. MVP na końcu - rozstrzyga się po wszystkim.
 *
 * Ta kolejność jest OŚ X wykresu, więc pomyłka tutaj rysuje przebieg
 * turnieju w złej kolejności i nikt tego nie zgłosi, bo wykres wygląda
 * poprawnie.
 */
export const PHASE_ORDER = [
  "playin",
  "swiss",
  "doubleelim",
  "playoffs",
  "mvp",
];

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/**
 * Punkty fazowe jednego gracza w jednym turnieju.
 *
 * @param rows wiersze { phase, stage, points } - po jednym na etap Swiss
 *             i po jednym na każdą z pozostałych faz
 * @returns {{ total: number, groups: Array, progress: Array }}
 */
export function buildPhasePoints(rows) {
  const uporzadkowane = (rows || [])
    .filter((r) => r && PHASE_ORDER.includes(r.phase))
    .map((r) => ({
      phase: r.phase,
      stage: r.stage ?? null,
      points: liczba(r.points),
    }))
    .sort(
      (a, b) =>
        PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) ||
        // Etapy Swiss to enum 'stage1'..'stage3' - porównanie napisów
        // ustawia je poprawnie i nie wymaga listy etapów w tym module.
        String(a.stage ?? "").localeCompare(String(b.stage ?? "")),
    );

  const sumy = new Map();

  for (const w of uporzadkowane) {
    sumy.set(w.phase, (sumy.get(w.phase) ?? 0) + w.points);
  }

  // Kafelki tylko dla faz, w których coś padło.
  //
  // Wiersz z zerem istnieje dla prawie każdego uczestnika - mvp_scores ma
  // 99 wierszy i 15 punktów łącznie - więc kafelek „MVP 0" pojawiłby się
  // niemal wszystkim i nie mówiłby nic poza tym, że faza się odbyła.
  const groups = PHASE_ORDER.filter((f) => (sumy.get(f) ?? 0) > 0).map((f) => ({
    phase: f,
    points: sumy.get(f),
  }));

  // Przebieg NIE pomija zer. Etap, w którym gracz nie wziął nic, jest
  // płaskim odcinkiem wykresu i to jest informacja - inaczej przebieg
  // wyglądałby na równy wzrost, a nie na przestój.
  let narastajaco = 0;

  const progress = uporzadkowane.map((w, i) => {
    narastajaco += w.points;

    return {
      n: i + 1,
      phase: w.phase,
      stage: w.stage,
      points: w.points,
      total: narastajaco,
    };
  });

  return { total: narastajaco, groups, progress };
}
