// Karta "największy upset" na stronie eventu.
//
// Wynik meczu przychodzi z serwera zawsze w kolejności res_a:res_b, czyli
// drużyna A do drużyny B. Karta wypisywała go dosłownie obok nazwy zwycięzcy,
// więc kiedy wygrywała drużyna B, wychodziło "9z wygrał 1:2" - zdanie, które
// czyta się jak literówka albo jak pomyłka w danych. A to jest jedna z
// pierwszych rzeczy, które widzi ktoś wchodzący z podesłanego linku.

/**
 * Wynik z liczbą zwycięzcy z przodu, czyli tak, jak się mówi: "wygrał 2:1".
 *
 * Przy danych, z których nie wynika, kto wygrał, zostaje kolejność z serwera -
 * lepiej pokazać wynik surowy niż zgadnąć i odwrócić go w złą stronę.
 */
// Number(null) i Number("") dają ZERO, nie NaN - a brakujący wynik pokazany
// jako "2:0" to nie jest brak wyniku, tylko wynik nieprawdziwy. Stąd odrzucenie
// pustek przed zamianą na liczbę.
function liczba(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === "") return NaN;

  return Number(wartosc);
}

export function winnerFirstScore(upset) {
  const a = liczba(upset?.res_a);
  const b = liczba(upset?.res_b);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  // Porównanie po nazwie, bo tak serwer wskazuje zwycięzcę. Gdy nie pasuje do
  // żadnej ze stron - a bywa tak przy starych danych - nie zamieniamy nic.
  const wygralaB =
    upset?.winner != null &&
    upset.winner === upset.team_b &&
    upset.winner !== upset.team_a;

  return wygralaB ? `${b}:${a}` : `${a}:${b}`;
}

/**
 * Czy zwycięzcy nie wytypował dosłownie nikt.
 *
 * Tylko przy zerze co do joty. Gdyby serwer przysłał 0.4%, "nikt" byłoby
 * nieprawdą - ktoś jednak postawił, tylko zaokrąglenie go zjadło.
 */
export function nobodyPickedWinner(upset) {
  return Number(upset?.winner_percentage) === 0;
}
