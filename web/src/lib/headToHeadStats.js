// Która strona porównania wypada lepiej w danej statystyce.
//
// Wydzielone z widoku, bo dwa przypadki łatwo tu przeoczyć, a oba kończą się
// zaznaczeniem na zielono niewłaściwego gracza:
//
//  1. w miejscu w rankingu LEPIEJ znaczy MNIEJ - "#3" bije "#40";
//  2. miejsce bywa puste (null) dla kogoś, kto nie jest sklasyfikowany.
//     Brak miejsca nie jest miejscem zerowym, więc nie może wygrywać
//     z prawdziwym miejscem tylko dlatego, że zero jest małe.

function liczbaAlbo(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null;

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : null;
}

/**
 * Zwraca "a", "b" albo null przy remisie i przy braku danych po obu stronach.
 *
 * @param {object} [opcje]
 * @param {boolean} [opcje.lowerIsBetter] - dla miejsca w rankingu.
 */
export function betterSide(a, b, { lowerIsBetter = false } = {}) {
  const liczbaA = liczbaAlbo(a);
  const liczbaB = liczbaAlbo(b);

  if (liczbaA === null && liczbaB === null) return null;

  // Brak wartości przegrywa z każdą wartością - także wtedy, gdy mniejsze
  // jest lepsze. Inaczej gracz bez miejsca w rankingu "wygrywałby" miejsce.
  if (liczbaA === null) return "b";
  if (liczbaB === null) return "a";

  if (liczbaA === liczbaB) return null;

  const aLepszy = lowerIsBetter ? liczbaA < liczbaB : liczbaA > liczbaB;

  return aLepszy ? "a" : "b";
}

/**
 * Punkty obu graczy narastająco, mecz po meczu.
 *
 * Bierze wyłącznie mecze rozstrzygnięte - nierozegrany mecz nie dodaje nic
 * do żadnej sumy, więc na wykresie byłby płaskim odcinkiem udającym, że ktoś
 * przestał zdobywać punkty.
 *
 * Odwraca kolejność, bo trasa oddaje mecze od najnowszego (ORDER BY id DESC),
 * a wykres czyta się od lewej do prawej, czyli od początku turnieju.
 */
export function duelProgress(matches) {
  const rozstrzygniete = (matches || []).filter((m) => m?.settled).reverse();

  let sumaA = 0;
  let sumaB = 0;

  const a = [];
  const b = [];

  rozstrzygniete.forEach((m, i) => {
    const punktyA = Number(m.a?.points ?? 0);
    const punktyB = Number(m.b?.points ?? 0);

    sumaA += punktyA;
    sumaB += punktyB;

    const label = m.team_a && m.team_b ? `${m.team_a} vs ${m.team_b}` : null;

    a.push({ n: i + 1, label, points: punktyA, total: sumaA });
    b.push({ n: i + 1, label, points: punktyB, total: sumaB });
  });

  return { a, b };
}

/**
 * Szerokości trzech części paska pojedynku, w procentach.
 *
 * Bez rozegranych meczów pasek jest pusty, a nie podzielony po równo -
 * podział po równo sugerowałby remis, którego nie ma czym uzasadnić.
 */
export function splitWidths({ wins_a = 0, wins_b = 0, ties = 0 } = {}) {
  const razem = wins_a + wins_b + ties;

  if (razem <= 0) return { a: 0, b: 0, tie: 0 };

  const procent = (n) => (n / razem) * 100;

  return {
    a: procent(wins_a),
    b: procent(wins_b),
    tie: procent(ties),
  };
}
