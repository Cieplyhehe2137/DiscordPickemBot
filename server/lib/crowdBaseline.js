// Tłum jako miara odniesienia: co dałoby typowanie zawsze tego, co większość.
//
// CZEGO BRAKOWAŁO. Każda liczba w serwisie jest bezwzględna. „69% trafień",
// „268 punktów", „73 trafionych zwycięzców" - i nic nie mówi, czy to dużo.
// Jedyne porównanie, jakie strona daje, to miejsce w tabeli, czyli
// porównanie z ludźmi. Nie ma odpowiedzi na pytanie, czy własny osąd dołożył
// cokolwiek do osądu grupy.
//
// Zmierzone na produkcji - większość liczona BEZ GŁOSU SAMEGO GRACZA:
//
//                             Kolonia        Kraków
//   tłum trafił               71 ze 106      26 z 50
//   miejsce w skuteczności    #14 z 48       #45 z 61
//   graczy lepszych od tłumu  27%            72%
//   ludzie vs tłum            62% vs 67%     57% vs 53%
//
// W Kolonii tłum czyta mecze lepiej niż trzy czwarte ludzi, którzy przeszli
// z nim turniej. W Krakowie jest odwrotnie: był bliski rzutu monetą i pobiły
// go niemal trzy czwarte stawki. Ta sama miara opowiada o dwóch turniejach
// dwie różne historie.
//
// DLACZEGO STAWKA JEST MAŁA, I DLACZEGO TAK MA BYĆ. Stało tu wcześniej
// „#6 z 410" - miejsce w tabeli TRAFIEŃ wśród wszystkich, którzy oddali
// choć jeden typ. Obie liczby były prawdziwe i obie wprowadzały w błąd.
// Tłum typuje KAŻDY mecz, a 163 z tych 410 osób oddało dokładnie jeden typ:
// „wyprzedził czterysta cztery osoby" mówiło głównie o tym, że był obecny.
// Porównanie ma sens dopiero z ludźmi, którzy też przeszli turniej - stąd
// ten sam próg, na którym stoi tabela skuteczności (połowa meczów).
//
// CZEGO TA LICZBA NIE MÓWI. Większość liczy się PO FAKCIE, ze wszystkich
// oddanych typów - nie dało się jej znać przed terminem, więc to nie jest
// strategia, którą ktoś mógł zastosować. To miara tego, czy własny wybór
// dołożył coś do wyboru grupy, i tak jest podpisana na stronie.
//
// BEZ ZAPYTAŃ - regułę da się sprawdzić bez bazy. Jedyny import to próg
// stawki, wzięty stamtąd, gdzie jest definiowany, żeby tabela skuteczności
// i to porównanie nigdy nie mówiły o dwóch różnych grupach ludzi.

import { progTypow } from "./accuracyRanking.js";

/**
 * Poniżej tylu typów porównanie z tłumem nic nie znaczy.
 *
 * Nie chodzi o istotność statystyczną, tylko o czytelność: „+1 wobec tłumu"
 * z trzech meczów to szum, a w tabeli stanęłoby obok „+3 ze 103". Zmierzone
 * w Kolonii: mediana pokrycia to DWA PROCENT okazji, a 81% sklasyfikowanych
 * oddało mniej niż co dziesiąty typ - bez progu ranking przewagi zapełniliby
 * ludzie z jednym szczęśliwym typem.
 */
export const MIN_TYPOW = 20;

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/** Czy wartość z bazy znaczy „prawda". MySQL oddaje 1/0, nie true/false. */
function prawda(wartosc) {
  return Boolean(Number(wartosc));
}

/**
 * Tłum w skali całego turnieju.
 *
 * @param matches   wiersze { match_id, on_a, on_b, winner_a } - po jednym na
 *                  ROZSTRZYGNIĘTY mecz, z liczbą typów na każdą ze stron
 * @param players   wiersze { user_id, displayname, correct_winners,
 *                  total_predictions } - to samo, co już stoi w rankingu
 * @param threshold ile typów wpuszcza do stawki; domyślnie próg tabeli
 *                  skuteczności, czyli połowa rozstrzygniętych meczów
 */
export function buildCrowdBaseline({
  matches = [],
  players = [],
  threshold = null,
} = {}) {
  const rozstrzygniete = (matches || []).filter((m) => m);

  let trafil = 0;

  for (const m of rozstrzygniete) {
    const naA = liczba(m.on_a);
    const naB = liczba(m.on_b);

    // Remis głosów rozstrzygamy na korzyść drużyny A - i to jest wybór
    // arbitralny, więc niech będzie jawny. Alternatywa (pomijanie meczu)
    // dawałaby tłumowi mniej okazji niż ludziom, czyli porównywałaby dwie
    // różne rzeczy. Zmierzone: w bazie taki remis nie zdarzył się ani razu
    // na 156 meczach - to zabezpieczenie, nie reguła.
    const wiekszoscNaA = naA >= naB;

    if (wiekszoscNaA === prawda(m.winner_a)) trafil += 1;
  }

  // STAWKĄ SĄ CI, KTÓRZY PRZESZLI TURNIEJ RAZEM Z TŁUMEM.
  //
  // Dwa powody, oba zmierzone w Kolonii. Do klasyfikacji wchodzi się też za
  // same typy na fazy - 114 z 523 osób nie oddało ANI JEDNEGO typu meczowego
  // i w tej konkurencji w ogóle nie startowało. A z pozostałych 409 aż 163
  // oddało dokładnie jeden typ; stawianie tłumu, który wytypował 106 meczów,
  // obok kogoś z jednym trafieniem nie jest porównaniem.
  const prog =
    threshold === null || threshold === undefined
      ? progTypow(rozstrzygniete.length)
      : Math.max(1, liczba(threshold));

  const stawka = (players || []).filter(
    (p) => liczba(p?.total_predictions) >= prog,
  );

  const skutecznoscTlumu =
    rozstrzygniete.length > 0 ? trafil / rozstrzygniete.length : 0;

  /** Odsetek trafień gracza, jako ułamek - na zaokrąglonym remisowałoby pół tabeli. */
  const skutecznosc = (p) => {
    const typow = liczba(p?.total_predictions);

    return typow > 0 ? liczba(p?.correct_winners) / typow : 0;
  };

  // Kto CZYTA MECZE LEPIEJ. Porównujemy odsetkiem, nie liczbą trafień:
  // trafień tłum ma z definicji dużo, bo typuje każdy mecz, a to jest
  // zasługa obecności, nie oka. Równo liczy się jako nie-lepiej - tłum ma
  // być poprzeczką, a nie kimś, kogo wystarczy dogonić.
  const lepsi = stawka
    .filter((p) => skutecznosc(p) > skutecznoscTlumu)
    .sort((a, b) => skutecznosc(b) - skutecznosc(a));

  return {
    matches: rozstrzygniete.length,
    correct: trafil,

    // null, a nie zero, przy turnieju bez rozstrzygniętych meczów.
    accuracy:
      rozstrzygniete.length > 0
        ? Math.round((100 * trafil) / rozstrzygniete.length)
        : null,

    players: stawka.length,

    // Ile typów wpuszcza do stawki. Idzie na front, bo „#14 z 48" bez
    // powiedzenia, kim jest tych czterdziestu ośmiu, jest zagadką.
    threshold: prog,

    // Miejsce w tabeli SKUTECZNOŚCI - tej samej, którą ranking pokazuje
    // po przełączeniu osi. Nie w rankingu punktów: tamten liczy też
    // dokładne wyniki map i typy na fazy, których ta miara nie dotyczy.
    rank: lepsi.length + 1,

    beatenBy: lepsi.map((p) => ({
      user_id: String(p.user_id),
      displayname: p.displayname ?? null,
      correct_winners: liczba(p.correct_winners),
      total_predictions: liczba(p.total_predictions),
      accuracy: Math.round(100 * skutecznosc(p)),
    })),
  };
}

/**
 * Rozkład głosów w jednym meczu BEZ GŁOSU SAMEGO GRACZA.
 *
 * Bez tego odjęcia każdy startowałby z przewagą jednego głosu po swojej
 * stronie, i tym większą, im mniej osób typowało dany mecz.
 *
 * Eksportowane, bo tej samej reguły używa server/lib/keyDecisions.js -
 * a dwie kopie odjęcia własnego głosu to dwie okazje, żeby jedna z nich
 * po cichu przestała odejmować.
 *
 * @param wiersz { mine_a, winner_a, on_a, on_b }
 */
export function bezTwojegoGlosu(wiersz) {
  const mojeNaA = prawda(wiersz?.mine_a);

  return {
    mojeNaA,
    wygralA: prawda(wiersz?.winner_a),
    naA: liczba(wiersz?.on_a) - (mojeNaA ? 1 : 0),
    naB: liczba(wiersz?.on_b) - (mojeNaA ? 0 : 1),
  };
}

/**
 * Jeden gracz wobec tłumu.
 *
 * Większość liczona BEZ JEGO GŁOSU - patrz bezTwojegoGlosu wyżej.
 *
 * @param rows wiersze { mine_a, winner_a, on_a, on_b } - po jednym na mecz,
 *             który ten gracz wytypował i który się rozstrzygnął
 */
export function buildPlayerVsCrowd(rows = []) {
  let policzonych = 0;
  let moje = 0;
  let tlumu = 0;
  let bezWiekszosci = 0;

  for (const w of rows || []) {
    if (!w) continue;

    const { mojeNaA, wygralA, naA, naB } = bezTwojegoGlosu(w);

    // Bez własnego głosu potrafi zostać remis - i wtedy nie ma czego
    // naśladować. Mecz wypada z porównania po OBU stronach, żeby nie
    // liczyć graczowi trafienia w meczu, w którym tłum nie miał zdania.
    if (naA === naB) {
      bezWiekszosci += 1;
      continue;
    }

    policzonych += 1;

    if (mojeNaA === wygralA) moje += 1;
    if (naA > naB === wygralA) tlumu += 1;
  }

  return {
    matches: policzonych,
    correct: moje,
    crowd: tlumu,
    advantage: moje - tlumu,

    // Ile meczów odpadło z porównania. Widoczne w odpowiedzi, bo inaczej
    // „38 meczów" na profilu kłóciłoby się z „44 wytypowanymi" obok.
    tied: bezWiekszosci,

    // Poniżej progu liczba jest szumem i strona ma ją przemilczeć,
    // a nie pokazać ostrożniej.
    enough: policzonych >= MIN_TYPOW,
  };
}
