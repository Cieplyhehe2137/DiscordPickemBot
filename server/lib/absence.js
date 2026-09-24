// Ile kosztowała nieobecność: mecze, których ten gracz NIE wytypował.
//
// CZEGO BRAKOWAŁO. Cały serwis liczy to, co ktoś zrobił. Ani jedna liczba
// nie mówi o tym, czego nie zrobił - a to jest w tych danych zjawisko
// pierwszego rzędu, nie margines. Zmierzone w IEM Cologne Major 2026,
// 106 rozstrzygniętych meczów i 409 osób z choć jednym typem:
//
//   mediana typującego pominęła 103 ze 106 meczów
//   komplet wytypowały CZTERY osoby
//   łącznie pominięć: 36 930
//
// Ranking pokazuje od niedawna pokrycie („103 z 106 typów"), więc SAMĄ
// liczbę pominięć widać. Nie widać jej ceny.
//
// JAK LICZYMY CENĘ. Na każdym pominiętym meczu stawiamy to, co postawiła
// większość - czyli najprostszy możliwy zastępnik decyzji, ten sam, którym
// mierzy się tłum w server/lib/crowdBaseline.js. Ile z tego trafiło, tyle
// razy stawka za zwycięzcę serii. Zmierzone:
//
//   rekordzista Kolonii   +142 pkt i skok o 47 miejsc (#376 -> #329)
//   399 z 409 osób        zmieniłoby miejsce w rankingu
//   czołowa piątka        od 0 do +4 pkt - oni po prostu byli
//
// CZEGO TA LICZBA NIE MÓWI, i strona ma to napisać. Nie jest to punktacja
// alternatywna ani „tyle Ci się należało": większość liczy się PO FAKCIE,
// ze wszystkich oddanych typów, więc przed terminem nikt jej nie znał.
// To jest wycena OKAZJI, a nie krzywda - miara tego, ile turnieju przeszło
// obok, wyrażona w jedynej walucie, jaką ten serwis ma.
//
// STAWKA IDZIE Z ZEWNĄTRZ. rules/scoring.js jest jedynym źródłem stałych
// punktowych i ma nim zostać - wpisanie tu dwójki na sztywno dałoby drugie
// miejsce, w którym trzeba pamiętać o zmianie regulaminu. Pilnuje tego
// test scoringContract.
//
// CZYSTY, BEZ ZAPYTAŃ - regułę da się sprawdzić bez bazy.

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/** Czy wartość z bazy znaczy „prawda". MySQL oddaje 1/0, nie true/false. */
function prawda(wartosc) {
  return Boolean(Number(wartosc));
}

/**
 * Cena nieobecności.
 *
 * @param rows            wiersze { mine, winner_a, on_a, on_b } - po jednym
 *                        na KAŻDY rozstrzygnięty mecz turnieju, nie tylko na
 *                        te wytypowane; `mine` mówi, czy ten gracz typował
 * @param pointsPerWinner stawka za trafionego zwycięzcę serii, z rules/scoring
 */
export function buildAbsence({ rows = [], pointsPerWinner = 0 } = {}) {
  const stawka = Math.max(0, liczba(pointsPerWinner));

  let rozstrzygnietych = 0;
  let wytypowanych = 0;
  let tlumTrafil = 0;

  for (const w of rows || []) {
    if (!w) continue;

    rozstrzygnietych += 1;

    if (prawda(w.mine)) {
      wytypowanych += 1;
      continue;
    }

    // Remis głosów rozstrzygamy na korzyść drużyny A - tak samo jak przy
    // tłumie w skali turnieju, i z tego samego powodu: wybór jest arbitralny,
    // więc niech będzie jawny i jeden na cały serwis. Zmierzone: w bazie taki
    // remis nie zdarzył się ani razu na 156 meczach.
    const wiekszoscNaA = liczba(w.on_a) >= liczba(w.on_b);

    if (wiekszoscNaA === prawda(w.winner_a)) tlumTrafil += 1;
  }

  const pominietych = rozstrzygnietych - wytypowanych;

  return {
    settled: rozstrzygnietych,
    picked: wytypowanych,
    skipped: pominietych,

    // Ile z pominiętych trafiłaby większość - i ile to punktów.
    crowdHits: tlumTrafil,
    points: tlumTrafil * stawka,

    // Jaką część turnieju ten człowiek w ogóle obejrzał. Bez tego „+142 pkt"
    // nie mówi, czy ktoś pominął pięć meczów, czy sto pięć.
    coverage:
      rozstrzygnietych > 0
        ? Math.round((100 * wytypowanych) / rozstrzygnietych)
        : null,

    // Komplet nie ma o czym pisać. Cztery osoby w Kolonii, piętnaście
    // w Krakowie - dla nich sekcja znika, zamiast pokazywać rząd zer.
    enough: pominietych > 0,
  };
}
