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
//   miejsce w tabeli trafień  #6 z 410       #28 z 252
//   graczy lepszych od tłumu  15%            65%
//   ludzie vs tłum            62% vs 67%     57% vs 53%
//
// W Kolonii bezmyślne chodzenie za większością dałoby szóste miejsce na 410
// typujących - pięć osób trafiło więcej. Najlepszy człowiek wygrał z tłumem
// o trzy mecze na 103. W Krakowie jest odwrotnie: tłum był bliski rzutu
// monetą i dwie trzecie ludzi go pobiło. Ta sama miara opowiada o dwóch
// turniejach dwie różne historie.
//
// CZEGO TA LICZBA NIE MÓWI. Większość liczy się PO FAKCIE, ze wszystkich
// oddanych typów - nie dało się jej znać przed terminem, więc to nie jest
// strategia, którą ktoś mógł zastosować. To miara tego, czy własny wybór
// dołożył coś do wyboru grupy, i tak jest podpisana na stronie.
//
// CZYSTY, BEZ IMPORTÓW - regułę da się sprawdzić bez bazy.

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
 * @param matches wiersze { match_id, on_a, on_b, winner_a } - po jednym na
 *                ROZSTRZYGNIĘTY mecz, z liczbą typów na każdą ze stron
 * @param players wiersze { user_id, displayname, correct_winners } - to samo,
 *                co już stoi w rankingu
 */
export function buildCrowdBaseline({ matches = [], players = [] } = {}) {
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

  // STAWKĄ SĄ CI, KTÓRZY TYPOWALI MECZE - nie wszyscy sklasyfikowani.
  //
  // Do klasyfikacji wchodzi się też za same typy na fazy: w Kolonii 114
  // z 523 osób nie oddało ANI JEDNEGO typu meczowego. Liczenie ich do
  // stawki dawało „szóste miejsce z 524" i sugerowało, że tłum wyprzedził
  // pięciuset ludzi - podczas gdy stu czternastu w tej konkurencji
  // w ogóle nie startowało.
  const stawka = (players || []).filter(
    (p) => liczba(p?.total_predictions) > 0,
  );

  // Kto trafił WIĘCEJ. Równo liczy się jako nie-lepiej: tłum ma być
  // poprzeczką, a nie kimś, kogo wystarczy dogonić.
  const lepsi = stawka
    .filter((p) => liczba(p?.correct_winners) > trafil)
    .sort((a, b) => liczba(b.correct_winners) - liczba(a.correct_winners));

  return {
    matches: rozstrzygniete.length,
    correct: trafil,

    // null, a nie zero, przy turnieju bez rozstrzygniętych meczów.
    accuracy:
      rozstrzygniete.length > 0
        ? Math.round((100 * trafil) / rozstrzygniete.length)
        : null,

    players: stawka.length,

    // Miejsce, które tłum zająłby w tabeli TRAFIEŃ - nie w rankingu punktów.
    // To rozróżnienie jest istotne: ranking liczy też dokładne wyniki map
    // i typy na fazy, których ta miara w ogóle nie dotyczy.
    rank: lepsi.length + 1,

    beatenBy: lepsi.map((p) => ({
      user_id: String(p.user_id),
      displayname: p.displayname ?? null,
      correct_winners: liczba(p.correct_winners),
    })),
  };
}

/**
 * Jeden gracz wobec tłumu.
 *
 * Większość liczona BEZ JEGO GŁOSU - inaczej każdy startowałby z przewagą
 * jednego głosu po swojej stronie, i tym większą, im mniej osób typowało
 * dany mecz.
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

    const mojeNaA = prawda(w.mine_a);
    const wygralA = prawda(w.winner_a);

    const naA = liczba(w.on_a) - (mojeNaA ? 1 : 0);
    const naB = liczba(w.on_b) - (mojeNaA ? 0 : 1);

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
