// Czy trzeba było mieć rację: trafienia oczywiste kontra zarobione.
//
// CZEGO BRAKOWAŁO. Serwis mówi, KTO miał rację. Ani razu nie mówi, czy
// trzeba było ją mieć. Trafiony zwycięzca to 2 punkty niezależnie od tego,
// czy wytypowało go całe pole, czy cztery procent. Jeden koniec tej skali
// jest opisany - server/lib/upsets.js robi „mecze, w których myliła się
// większość", z progiem 25%. Drugiego końca nie było nigdzie.
//
// ILE TO WAŻY. Zmierzone na wszystkich 155 meczach w bazie mających co
// najmniej dwadzieścia typów: 53 mecze (34%) trafiło ponad 85% pola,
// dwadzieścia trzy z nich ponad 95%. W Kolonii dwa mecze trafili WSZYSCY
// - Vitality-MOUZ i G2-Monte.
//
// W samej Kolonii (106 meczów, 409 typujących, 39 meczów oczywistych):
//
//   55% wszystkich trafień pola leży na tych 39 meczach
//   u 250 z 409 osób ponad połowa trafień to właśnie one
//   czołowa dwudziestka dzieli 34-39 identycznych trafień,
//     a różni się o jedenaście
//
// Po odjęciu meczów oczywistych kolejność się rusza: #9 wchodzi na #3
// (69 trafień, ale 35 zarobionych), #16 spada na #27 - trafił wszystkie
// trzydzieści dziewięć oczywistych i dwadzieścia pięć reszty.
//
// DWA PROGI, KAŻDY Z INNEGO POWODU.
//
// MIN_GLOSUJACYCH. Mecz z trzema typami pokazuje „100% trafiło" i nie
// znaczy to nic - trzy osoby to nie jest pole. Ten sam próg, z tego samego
// powodu, stoi w upsets.js; 155 ze 156 meczów w bazie ma ich więcej.
//
// PROG_OCZYWISTEGO. NIE jest lustrem ćwiartki z niespodzianek i nie ma być.
// Pole trafia 58-65% zależnie od fazy, więc oba końce skali nie są
// symetryczne - odbicie progu 25% dałoby 75%, a w to wpada 46% meczów
// i „oczywisty" przestaje cokolwiek znaczyć. Histogram nie ma doliny,
// rośnie monotonicznie od czterdziestu procent w górę, więc próg jest
// decyzją, a nie odkryciem: przy 85% zostaje 34% bazy, a trzy najwyższe
// kubełki (14 + 16 + 23 meczów) trafiają tam w całości.
//
// CZEGO TA LICZBA NIE MÓWI, i strona ma to napisać. „Oczywisty" jest
// oczywisty DOPIERO PO FAKCIE - zgodę pola liczymy ze wszystkich oddanych
// typów, a przed terminem nikt jej nie znał. To samo zastrzeżenie stoi pod
// tłumem i pod nieobecnością.
//
// CZYSTY, BEZ ZAPYTAŃ - regułę da się sprawdzić bez bazy.

/**
 * Poniżej tylu głosów mecz w ogóle nie jest klasyfikowany.
 *
 * Taki mecz NIE jest oczywisty - wpada do zarobionych, a nie znika, żeby
 * suma „oczywiste + zarobione" dalej równała się trafieniom. Przy 155 ze
 * 156 meczów powyżej progu kosztuje to w praktyce nic.
 */
export const MIN_GLOSUJACYCH = 20;

/** Od ilu procent zgody pola mecz uznajemy za oczywisty. */
export const PROG_OCZYWISTEGO = 85;

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/** Czy wartość z bazy znaczy „prawda". MySQL oddaje 1/0, nie true/false. */
function prawda(wartosc) {
  return Boolean(Number(wartosc));
}

function procent(ile, z) {
  return z > 0 ? Math.round((100 * ile) / z) : null;
}

/**
 * Czy ten mecz był oczywisty - jedno miejsce na całą regułę.
 *
 * @param wiersz { winner_a, on_a, on_b }
 */
export function oczywisty(wiersz) {
  const naA = liczba(wiersz?.on_a);
  const naB = liczba(wiersz?.on_b);
  const glosow = naA + naB;

  if (glosow < MIN_GLOSUJACYCH) return false;

  const zaZwyciezca = prawda(wiersz?.winner_a) ? naA : naB;

  return (100 * zaZwyciezca) / glosow >= PROG_OCZYWISTEGO;
}

/**
 * Miejsce w polu według trafień zarobionych.
 *
 * Bez progu uczestnictwa, w odróżnieniu od skuteczności - bo to jest
 * LICZBA, a nie odsetek. Kto oddał pięć typów, ma najwyżej pięć zarobionych
 * trafień i sam nie wejdzie wysoko. Zmierzone: czołowa piątka wg zarobionych
 * ma po 69-74 trafień ogółem, czyli są to ci sami ludzie, co w czołówce
 * tabeli - tylko w innej kolejności.
 *
 * @param fieldRows wiersze { user_id, earned } - po jednym na gracza
 * @param userId    kogo szukamy
 */
export function miejsceWedlugZarobionych(fieldRows, userId) {
  if (!Array.isArray(fieldRows) || fieldRows.length === 0) return null;

  const szukany = String(userId ?? "");
  const moj = fieldRows.find((w) => String(w?.user_id ?? "") === szukany);

  if (!moj) return null;

  const moje = liczba(moj.earned);

  // Miejsce jak w zawodach: ilu ma ŚCIŚLE więcej, plus jeden. Remis daje
  // to samo miejsce obu, zamiast rozstrzygać go czymś przypadkowym.
  let lepszych = 0;

  for (const w of fieldRows) {
    if (liczba(w?.earned) > moje) lepszych += 1;
  }

  return { rank: lepszych + 1, players: fieldRows.length, earned: moje };
}

/**
 * Trudność trafień jednego gracza.
 *
 * @param rows            wiersze { mine, mine_a, winner_a, on_a, on_b } - po
 *                        jednym na KAŻDY rozstrzygnięty mecz turnieju
 * @param fieldRows       wiersze { user_id, earned } dla całego pola;
 *                        bez nich sekcja działa, tylko bez miejsca
 * @param userId          czyj to profil
 * @param pointsPerWinner stawka za trafionego zwycięzcę, z rules/scoring
 */
export function buildMatchDifficulty({
  rows = [],
  fieldRows = [],
  userId = null,
  pointsPerWinner = 0,
} = {}) {
  const stawka = Math.max(0, liczba(pointsPerWinner));

  let meczow = 0;
  let oczywistych = 0;

  let trafien = 0;
  let trafienOczywistych = 0;

  // To samo, ale dla CAŁEGO pola - do porównania „u Ciebie kontra u nich".
  // Idzie z tych samych wierszy, bo on_a i on_b to już są trafienia
  // wszystkich: żadnego zapytania więcej.
  let trafienPola = 0;
  let trafienPolaOczywistych = 0;

  for (const w of rows || []) {
    if (!w) continue;

    meczow += 1;

    const wygralA = prawda(w.winner_a);
    const zaZwyciezca = wygralA ? liczba(w.on_a) : liczba(w.on_b);
    const latwy = oczywisty(w);

    if (latwy) oczywistych += 1;

    trafienPola += zaZwyciezca;
    if (latwy) trafienPolaOczywistych += zaZwyciezca;

    if (!prawda(w.mine)) continue;
    if (prawda(w.mine_a) !== wygralA) continue;

    trafien += 1;
    if (latwy) trafienOczywistych += 1;
  }

  const zarobione = trafien - trafienOczywistych;

  // Miejsce POKAZUJEMY dopiero od jednego zarobionego trafienia.
  //
  // Przy zerze „#217 z 409" nie mówi o tym człowieku nic - jest w całości
  // policzone z tego, ilu innych zrobiło cokolwiek, i wyglądałoby na wynik.
  // Zmierzone: tak ma 193 z 409 osób w Kolonii i 70 z 251 w Krakowie.
  const miejsce =
    zarobione > 0 ? miejsceWedlugZarobionych(fieldRows, userId) : null;

  return {
    threshold: PROG_OCZYWISTEGO,
    minVoters: MIN_GLOSUJACYCH,

    matches: meczow,
    obvious: oczywistych,

    hits: trafien,
    obviousHits: trafienOczywistych,
    earnedHits: zarobione,

    // Punkty TYLKO za zarobione. Suma punktów gracza stoi wyżej na stronie
    // i ta sekcja nie ma jej powtarzać ani podważać.
    earnedPoints: zarobione * stawka,

    // Jaka część trafień leży na meczach oczywistych - u niego i u pola.
    // null, gdy nie ma z czego liczyć; zero znaczyłoby „ani jednego".
    share: procent(trafienOczywistych, trafien),
    fieldShare: procent(trafienPolaOczywistych, trafienPola),

    rank: miejsce?.rank ?? null,
    players: miejsce?.players ?? null,

    // Bez meczów oczywistych albo bez trafień nie ma o czym pisać.
    enough: oczywistych > 0 && trafien > 0,
  };
}
