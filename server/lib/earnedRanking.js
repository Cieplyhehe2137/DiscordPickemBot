// TRZECIA OS TEJ SAMEJ TABELI: ile trafien trzeba bylo zarobic.
//
// CZEGO BRAKOWALO. Ranking punktowy w duzej mierze mierzy obecnosc (patrz
// accuracyRanking.js), skutecznosc mierzy odsetek trafien - ale ani jedno,
// ani drugie nie pyta, czy te trafienia byly trudne. Trafiony zwyciezca to
// te same dwa punkty, czy wskazalo go cale pole, czy cztery procent.
//
// Profil gracza mowi to od dawna: kafelek "trafienia oczywiste i zarobione"
// liczy jedno i drugie, a lib/matchDifficulty.js potrafi nawet podac miejsce
// w polu wedlug zarobionych. Tabela rankingu nie uzywala tego ani razu.
//
// ILE TO ZMIENIA. Pomiar stoi w komentarzu matchDifficulty.js i dotyczy
// IEM Cologne Major 2026: 39 ze 106 rozstrzygnietych meczow trafilo ponad
// 85% pola, a lezy na nich 55% wszystkich trafien. Po odjeciu tych meczow
// kolejnosc sie rusza - #9 wchodzi na #3, #16 spada na #27. To nie jest
// kosmetyka, tylko inna odpowiedz na pytanie "kto typowal najlepiej".
//
// DLACZEGO TO NIE PODWAZA SUMY PUNKTOW. Zarobione punkty licza WYLACZNIE
// stawke za trafionego zwyciezce serii. Nie ma w nich punktow za mapy ani
// za typy na fazy, wiec nie sa "punktami gracza minus oczywiste" i nie maja
// sie z nimi sumowac. To osobna miara, pokazywana obok, a nie zamiast -
// dokladnie tak, jak robi to kafelek na profilu.
//
// PROG UCZESTNICTWA: ZADNEGO, i to jest swiadome. Skutecznosc ma prog
// (polowa rozstrzygnietych meczow), bo jest odsetkiem i przy pieciu typach
// klamie. Zarobione to LICZBA: kto oddal piec typow, ma najwyzej piec
// zarobionych trafien i sam nie wejdzie wysoko. Ten sam powod stoi przy
// miejscu w polu w matchDifficulty.js.
//
// CZYSTY, BEZ ZAPYTAN - regule da sie sprawdzic bez bazy.

/**
 * Od ilu zarobionych trafien gracz w ogole wchodzi do tej tabeli.
 *
 * Przy zerze wiersz nie mowi o czlowieku nic: jego miejsce byloby w calosci
 * policzone z tego, ilu innych zrobilo cokolwiek. Zmierzone w Kolonii: zero
 * zarobionych ma 193 z 409 typujacych, wiec polowa tabeli bylaby pusta
 * w tresci, a pelna w wierszach.
 */
export const MIN_EARNED_HITS = 1;

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Kolejnosc: zarobione trafienia, potem punkty, na koncu id.
 *
 * Punkty jako pierwszy rozstrzygacz remisu, bo przy tej samej liczbie
 * zarobionych trafien wyzej stoi ten, kto zrobil z turnieju wiecej - a nie
 * ten, kogo id wypadlo wczesniej. Id tylko po to, zeby kolejnosc byla
 * powtarzalna miedzy przebiegami.
 */
function compare(a, b) {
  const earned = number(b.earned_hits) - number(a.earned_hits);
  if (earned !== 0) return earned;

  const points = number(b.total_points) - number(a.total_points);
  if (points !== 0) return points;

  return String(a.user_id).localeCompare(String(b.user_id));
}

/**
 * Tabela ulozona wedlug trafien zarobionych.
 *
 * @param players      wiersze rankingu punktowego, z nadanym juz `rank`
 * @param earnedByUser Map user_id -> liczba zarobionych trafien
 * @param pointsPerHit stawka za trafionego zwyciezce, z rules/scoring.js;
 *                     tak samo jak w matchDifficulty.js nie jest wpisana
 *                     w tym pliku
 * @param matches      ile meczow turnieju jest rozstrzygnietych
 * @param obvious      ile z nich bylo oczywistych
 */
export function buildEarnedRanking({
  players = [],
  earnedByUser = new Map(),
  pointsPerHit = 0,
  matches = 0,
  obvious = 0,
} = {}) {
  const stake = Math.max(0, number(pointsPerHit));

  const field = (players || [])
    .filter(Boolean)
    .map((player) => {
      const hits = number(earnedByUser.get(String(player.user_id)));

      return { ...player, earned_hits: hits, earned_points: hits * stake };
    })
    .filter((player) => player.earned_hits >= MIN_EARNED_HITS);

  const sorted = [...field].sort(compare);

  return {
    matches: number(matches),
    obvious: number(obvious),
    threshold: MIN_EARNED_HITS,
    pointsPerHit: stake,
    players: sorted.length,

    rows: sorted.map((player, i) => {
      const pointsRank = number(player.rank);

      return {
        ...player,

        // Miejsce w TEJ tabeli. Nadpisuje punktowe swiadomie - front rysuje
        // po `rank` medale i numer wiersza, a tutaj pierwszy ma byc pierwszy.
        rank: i + 1,

        // Skad ten czlowiek przyszedl. Bez tego nie widac, ze trzecie miejsce
        // wedlug zarobionych stoi punktowo na dziewiatym - a po to sie tu
        // przychodzi.
        points_rank: pointsRank > 0 ? pointsRank : null,
      };
    }),
  };
}
