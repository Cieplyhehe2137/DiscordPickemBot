// Przeliczanie danych na współrzędne wykresu.
//
// Osobno od widoku, bo tu mieszkają wszystkie dzielenia - a każde z nich ma
// przypadek, w którym mianownik jest zerem i wykres znika bez śladu błędu:
//
//  - gracz z jednym rozegranym meczem (zakres osi X to zero),
//  - gracz z zerem punktów (zakres osi Y to zero),
//  - gracz bez meczów w ogóle.
//
// Zero punktów NIE jest przypadkiem brzegowym. Tak wygląda każdy, kto zapisał
// się na turniej i nie trafił nic, i takich w rankingu są dziesiątki.

// Układ w jednostkach viewBox. Sam SVG skaluje się do szerokości rodzica,
// więc to nie są piksele - to proporcje.
//
// Dwa układy, bo jeden stosunek boków nie obsłuży obu końców. SVG ze stałym
// viewBox skaluje się proporcjonalnie: 720 na 220 przy szerokości laptopa
// daje czytelne 220 pikseli wysokości, ale w kolumnie na telefonie (~310px)
// zostaje z tego pasek na osiemdziesiąt pikseli. Odwrotnie - stosunek dobry
// na telefon robi na laptopie wykres wyższy niż ekran.
//
// Rozciągnięcie przez preserveAspectRatio="none" wygląda na wyjście z tego
// i nim nie jest: deformuje też podpisy osi i grubość linii.
export const UKLAD = {
  width: 720,
  height: 220,

  padTop: 14,
  padRight: 14,
  padBottom: 26,
  padLeft: 38,
};

export const UKLAD_WASKI = {
  width: 380,
  height: 260,

  padTop: 12,
  padRight: 10,
  padBottom: 24,
  padLeft: 34,
};

export function obszar(uklad = UKLAD) {
  return {
    left: uklad.padLeft,
    right: uklad.width - uklad.padRight,
    top: uklad.padTop,
    bottom: uklad.height - uklad.padBottom,

    get szerokosc() {
      return this.right - this.left;
    },

    get wysokosc() {
      return this.bottom - this.top;
    },
  };
}

/**
 * Ładny krok podziałki: 1, 2, 5 i ich wielokrotności dziesiątek.
 *
 * Wartości osi mają być do przeczytania z daleka - "0, 50, 100, 150" czyta
 * się od razu, "0, 47, 94, 141" trzeba rozszyfrowywać.
 */
export function krokPodzialki(max, ile = 4) {
  // log10(0) to minus nieskończoność - bez tej bramki krok wychodzi zerem,
  // a pętla budująca wartości podziałki nigdy się nie kończy.
  if (!Number.isFinite(max) || max <= 0) return 1;

  const surowy = max / ile;
  const rzad = 10 ** Math.floor(Math.log10(surowy));

  // 2,5 jest w tym zestawie dla ćwiartek: przy stu punktach daje
  // 0-25-50-75-100 zamiast 0-50-100. Wchodzi tylko wtedy, gdy wynik jest
  // całkowity, bo punktów nie ma ułamkowych i oś z "2,5 pkt" byłaby fałszem.
  for (const mnoznik of [1, 2, 2.5, 5, 10]) {
    const krok = mnoznik * rzad;

    if (krok >= surowy && Number.isInteger(krok)) return krok;
  }

  return Math.max(1, Math.ceil(surowy));
}

/**
 * Wartości na osi Y, od zera w górę.
 */
export function podzialka(max, ile = 4) {
  const krok = krokPodzialki(max, ile);
  const gora = Math.max(krok, Math.ceil(max / krok) * krok);

  const wartosci = [];

  for (let v = 0; v <= gora + 1e-9; v += krok) wartosci.push(Math.round(v));

  return { wartosci, gora };
}

/**
 * Przelicza ciąg { n, total } na współrzędne.
 *
 * `gora` podaje się z zewnątrz, żeby dwa ciągi na jednym wykresie stały na
 * tej samej skali - inaczej gorszy gracz miałby linię tak samo wysoko jak
 * lepszy i wykres kłamałby dokładnie w tym, po co powstał.
 */
export function wspolrzedne(ciag, gora, uklad = UKLAD) {
  const o = obszar(uklad);
  const punkty = ciag || [];

  if (punkty.length === 0) return [];

  // Jeden punkt nie ma zakresu - staje na lewej krawędzi, a rysuje się jako
  // kropka. Dzielenie przez (length - 1) dałoby tu nieskończoność.
  const rozpietosc = punkty.length - 1;

  // Zero punktów u wszystkich: linia leży na dnie, zamiast zniknąć.
  const zakresY = gora > 0 ? gora : 1;

  return punkty.map((p, i) => ({
    ...p,
    x: rozpietosc === 0 ? o.left : o.left + (i / rozpietosc) * o.szerokosc,
    y: o.bottom - (p.total / zakresY) * o.wysokosc,
  }));
}

/**
 * Ścieżka łamanej przez podane współrzędne.
 */
export function sciezka(punkty) {
  if (!punkty?.length) return "";

  return punkty
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

/**
 * Ścieżka wypełnienia pod łamaną - ta sama linia domknięta do dna.
 */
export function sciezkaPola(punkty, uklad = UKLAD) {
  if (!punkty?.length) return "";

  const o = obszar(uklad);
  const pierwszy = punkty[0];
  const ostatni = punkty[punkty.length - 1];

  return (
    `M${pierwszy.x.toFixed(1)},${o.bottom} ` +
    punkty.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${ostatni.x.toFixed(1)},${o.bottom} Z`
  );
}
