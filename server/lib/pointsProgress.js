// Punkty narastająco, mecz po meczu.
//
// Suma punktów mówi, ile ktoś ma. Nie mówi, KIEDY to zebrał - a to jest
// pytanie, które ludzie zadają po turnieju: w którym momencie odpadłem,
// gdzie ktoś odskoczył, czy przegrałem równo, czy na jednym wieczorze.
//
// Wejściem są wiersze tego samego zapytania, które liczy serie: wszystkie
// rozstrzygnięte mecze gracza, już posortowane. Dokładanie osobnego
// zapytania kosztowałoby kolejną podróż do bazy, a te w tym projekcie
// kosztują około 165 ms sztuka.

function liczbaAlbo(wartosc, zapasowa = 0) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Zamienia wiersze meczów w ciąg punktów narastająco.
 *
 * Każdy punkt ciągu to jeden mecz: ile wzięto za niego i ile było łącznie
 * po nim. Numer `n` liczy się od jedynki i jest pozycją w turnieju, a nie
 * identyfikatorem meczu - na osi ma stać "który to był mecz", a nie liczba
 * z bazy, która potrafi zaczynać się od pięciuset czterdziestu.
 */
export function buildProgress(rows) {
  let suma = 0;

  return (rows || []).map((row, i) => {
    const points = liczbaAlbo(row.points);

    suma += points;

    return {
      n: i + 1,
      match_id: Number(row.match_id),

      // Etykieta do dymka nad punktem. Bez niej wykres pokazuje, ŻE coś się
      // wydarzyło w dwunastym meczu, ale nie co to było.
      label:
        row.team_a && row.team_b ? `${row.team_a} vs ${row.team_b}` : null,

      points,
      total: suma,
    };
  });
}
