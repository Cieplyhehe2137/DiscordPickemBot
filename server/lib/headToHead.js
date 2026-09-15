// Pojedynek dwóch graczy w obrębie jednego turnieju.
//
// Profil gracza pokazuje go "na tle eventu" - miejsce w rankingu i górne
// procenty. To odpowiada na pytanie "jak mi idzie", ale nie na "kto z nas
// dwóch typuje lepiej", bo dwie osoby mogą mieć podobne miejsce, obstawiając
// zupełnie inne mecze.
//
// Dlatego liczy się TYLKO to, co obaj typowali i co zostało rozstrzygnięte.
// Mecz, którego jeden z nich nie obstawił, nie mówi nic o ich przewadze nad
// sobą - a doliczony do sumy dawałby przewagę temu, kto po prostu typował
// częściej.

// Wartość, której w bazie nie ma. Musi być jawnie, bo Number(null) to ZERO,
// a nie NaN - mecz bez wyniku przeszedłby jako zakończony remisem 0:0.
function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Kto wygrał pojedynczy mecz: ten, kto wziął za niego więcej punktów.
 *
 * Punkty, a nie "trafiony zwycięzca": obaj mogą wskazać tę samą drużynę,
 * ale jeden trafi dokładny wynik serii i weźmie za to więcej. Porównywanie
 * samych zwycięzców robiłoby z takiego meczu remis.
 */
export function matchWinner(pointsA, pointsB) {
  const a = liczbaAlbo(pointsA, 0);
  const b = liczbaAlbo(pointsB, 0);

  if (a > b) return "a";

  if (b > a) return "b";

  return "tie";
}

/**
 * Czy typ wskazał zwycięzcę serii.
 *
 * Do pokazania przy typie, nie do liczenia przewagi - od tego są punkty.
 */
export function pickedWinner(predA, predB, resA, resB) {
  if (resA === null || resB === null) return false;

  return (predA > predB && resA > resB) || (predB > predA && resB > resA);
}

/**
 * Składa pojedynek z wierszy zapytania.
 *
 * Wiersz to jeden mecz, który obaj gracze obstawili - z wynikiem meczu
 * (albo bez, gdy jeszcze się nie odbył) i z punktami obu stron.
 */
export function buildDuel(rows) {
  const mecze = (rows || []).map((row) => {
    const resA = liczbaAlbo(row.res_a);
    const resB = liczbaAlbo(row.res_b);

    // Mecz jest rozstrzygnięty dopiero wtedy, gdy są OBIE strony wyniku.
    const settled = resA !== null && resB !== null;

    const aPredA = liczbaAlbo(row.a_pred_a, 0);
    const aPredB = liczbaAlbo(row.a_pred_b, 0);
    const bPredA = liczbaAlbo(row.b_pred_a, 0);
    const bPredB = liczbaAlbo(row.b_pred_b, 0);

    const aPoints = liczbaAlbo(row.a_points, 0);
    const bPoints = liczbaAlbo(row.b_points, 0);

    return {
      match_id: Number(row.match_id),

      team_a: row.team_a,
      team_b: row.team_b,

      best_of: liczbaAlbo(row.best_of, 0),

      res_a: resA,
      res_b: resB,

      settled,

      // Nierozstrzygnięty mecz nie ma zwycięzcy pojedynku. null, a nie
      // "tie" - remis to wynik, a tu wyniku jeszcze nie ma.
      winner: settled ? matchWinner(aPoints, bPoints) : null,

      // Ten sam typ u obu stron. Warto pokazać osobno: mecze, w których
      // się różnili, są jedynymi, które cokolwiek rozstrzygają.
      same_pick: aPredA === bPredA && aPredB === bPredB,

      a: {
        pred_a: aPredA,
        pred_b: aPredB,
        points: aPoints,
        correct: settled ? pickedWinner(aPredA, aPredB, resA, resB) : false,
      },

      b: {
        pred_a: bPredA,
        pred_b: bPredB,
        points: bPoints,
        correct: settled ? pickedWinner(bPredA, bPredB, resA, resB) : false,
      },
    };
  });

  const rozstrzygniete = mecze.filter((m) => m.settled);

  const summary = {
    // Ile meczów obaj obstawili - łącznie i po odsianiu nierozegranych.
    common: mecze.length,
    settled: rozstrzygniete.length,
    pending: mecze.length - rozstrzygniete.length,

    wins_a: rozstrzygniete.filter((m) => m.winner === "a").length,
    wins_b: rozstrzygniete.filter((m) => m.winner === "b").length,
    ties: rozstrzygniete.filter((m) => m.winner === "tie").length,

    // Suma punktów LICZONA TYLKO ZE WSPÓLNYCH MECZÓW. Różni się od sumy
    // z profilu i tak ma być - profil sumuje cały turniej, a tu chodzi
    // o dorobek z tych samych spotkań.
    points_a: rozstrzygniete.reduce((suma, m) => suma + m.a.points, 0),
    points_b: rozstrzygniete.reduce((suma, m) => suma + m.b.points, 0),

    // Mecze, w których obaj postawili identycznie - te nikogo nie dzielą.
    same_picks: rozstrzygniete.filter((m) => m.same_pick).length,
  };

  return { matches: mecze, summary };
}
