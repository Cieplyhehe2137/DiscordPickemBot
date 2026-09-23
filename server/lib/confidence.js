// Pewność typu: 2:0 kontra 2:1.
//
// KOLUMNA, KTÓRA NIE DAJE ANI JEDNEGO PUNKTU. Regulamin płaci wyłącznie za
// zwycięzcę serii, 2 pkt - utils/matchScoring.js mówi to wprost:
// „Dokładny wynik serii 2:0 / 2:1 nie daje już osobnych punktów". Czy ktoś
// napisze 2:0, czy 2:1, w rankingu nie zmienia nic. A wpisane jest przy
// każdym z 6959 typów na BO3.
//
// I OKAZUJE SIĘ NAJLEPSZYM SYGNAŁEM tego, czy ta osoba miała rację.
// Zmierzone na wszystkich turniejach:
//
//                    typów   trafiony zwycięzca   trafiony cały wynik
//   2:0 (pewny)       3450          67.2%                36.3%
//   2:1 (niepewny)    3509          52.3%                21.4%
//
// Piętnaście punktów procentowych. Kiedy ktoś wpisuje 2:1, mówi „nie jestem
// pewien" - i ma rację, bo trafia ledwie ponad rzut monetą.
//
// TO NIE JEST EFEKT ZBIOROWY. Wśród 102 osób z co najmniej dziesięcioma
// typami każdego rodzaju 88 (86%) trafia lepiej na swoich pewnych typach.
// Kakarucza trafił WSZYSTKIE dwanaście meczów, w których napisał 2:0.
//
// CZEGO TA LICZBA NIE MÓWI - i strona ma to napisać, zamiast udawać
// przyczynowość. Nie mówi, że pewność siebie czyni kogoś lepszym. Zależność
// idzie w drugą stronę: 2:1 wpisuje się w meczach, które faktycznie są
// wyrównane, więc niższa skuteczność jest po części własnością MECZU, nie
// człowieka. Wartość polega na tym, że ta samoocena okazuje się trafna -
// i że u czternastu osób jest odwrotna. Dla nich to jest konkretna
// informacja: ich poczucie pewności myli, i to systematycznie.
//
// TYLKO BO3. W BO1 nie ma czego mierzyć (wynik serii to zawsze 1:0),
// a BO5 ma w bazie dwa mecze i 66 typów - własne progi dla takiej próbki
// byłyby udawaniem dokładności. Podział robi zapytanie, ten moduł dostaje
// już policzone czwórki liczb.
//
// CZYSTY, BEZ ZAPYTAŃ - regułę da się sprawdzić bez bazy.

/**
 * Poniżej tylu typów KAŻDEGO rodzaju różnica nic nie znaczy.
 *
 * Przy pięciu typach jedno trafienie przesuwa wynik o dwadzieścia punktów
 * procentowych, więc „gorzej na pewnych" byłoby szumem. Zmierzone: próg
 * dziesięciu zostawia 48 osób w Kolonii i 55 w Krakowie - mniej więcej tę
 * samą stawkę, co tabela skuteczności.
 */
export const MIN_TYPOW = 10;

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

function strona(typow, trafien) {
  const ile = Math.max(0, liczba(typow));
  const traf = Math.max(0, Math.min(ile, liczba(trafien)));

  return {
    picks: ile,
    hits: traf,

    // null, a nie zero, gdy nie było ani jednego takiego typu - zero
    // znaczyłoby „nic nie trafił", a on po prostu tak nie typował.
    accuracy: ile > 0 ? Math.round((100 * traf) / ile) : null,
  };
}

/**
 * Pewność jednego gracza.
 *
 * @param sure      ile typów 2:0 (rozstrzygniętych, BO3)
 * @param sureHits  ile z nich trafiło zwycięzcę
 * @param close     ile typów 2:1
 * @param closeHits ile z nich trafiło zwycięzcę
 */
export function buildConfidence({
  sure = 0,
  sureHits = 0,
  close = 0,
  closeHits = 0,
} = {}) {
  const pewne = strona(sure, sureHits);
  const wyrownane = strona(close, closeHits);

  const dosc = pewne.picks >= MIN_TYPOW && wyrownane.picks >= MIN_TYPOW;

  // Różnica w punktach PROCENTOWYCH, liczona z zaokrąglonych odsetków -
  // tych samych, które widać na ekranie. Liczenie jej z surowych ułamków
  // dawałoby „+15", gdy kafelki pokazują 67% i 53%, czyli 14.
  const roznica =
    pewne.accuracy !== null && wyrownane.accuracy !== null
      ? pewne.accuracy - wyrownane.accuracy
      : null;

  return {
    sure: pewne,
    close: wyrownane,

    gap: roznica,

    // Odwrócona pewność. To jest jedyny przypadek, w którym ta sekcja mówi
    // komuś coś, czego nie wie: jego „jestem pewien" znaczy mniej niż jego
    // „chyba tak". W bazie takich osób jest czternaście na sto dwie.
    inverted: dosc && roznica !== null ? roznica < 0 : false,

    enough: dosc,
    threshold: MIN_TYPOW,
  };
}
