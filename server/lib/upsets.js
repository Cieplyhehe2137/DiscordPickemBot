// Niespodzianki: mecze, w których myliła się WIĘKSZOŚĆ typujących.
//
// Cały serwis mówi dziś, kto ma rację. Nie mówi ani razu, kiedy rację
// mieli prawie wszyscy, i kiedy nikt. A to drugie zdarza się stale -
// zmierzone na 156 rozstrzygniętych meczach i 10 328 typach:
//
//   Vitality - 9z            wygrało 9z            0 ze 41 typów
//   FURIA - FUT Esports      wygrało FUT           2 z 71
//   MIBR - THUNDER dOWNUNDER wygrało THUNDER       6 ze 149
//
// Czterdzieści jeden osób typowało ten pierwszy mecz i nie trafił nikt.
// Taki mecz jest dziś w bazie i nigdzie indziej.
//
// TRZY PROGI, KAŻDY Z INNEGO POWODU.
//
// MIN_TYPOW. Mecz z trzema typami potrafi pokazać „0% trafiło" i nie znaczy
// to nic - trzy osoby to nie jest społeczność. Dwadzieścia typów odcina ten
// przypadek i nie kosztuje prawie nic: 155 ze 156 meczów w bazie ma ich
// więcej.
//
// PROG_PROCENT. Poniżej ćwiartki trafień większość była po złej stronie na
// tyle wyraźnie, że to już nie jest mecz „niepewny", tylko pomyłka ogółu.
// Tło w takich meczach wynosi 14% (336 trafień na 2357 typów), więc ćwiartka
// to granica tuż nad tym, co wychodzi przypadkiem.
//
// MIN_OKAZJI. Ranking „kto trafia wbrew wszystkim" NIE MOŻE stać na liczbie
// trafień, bo liczba nagradza frekwencję - ten sam błąd, który odrzuciliśmy
// w klasyfikacji wszech czasów. Liczba okazji jest skrajnie nierówna: 431
// graczy, od 1 do 33 okazji, średnio 5.5. Ktoś z 33 okazjami zbierze więcej
// trafień od kogoś z dziesięcioma, nie będąc od niego lepszym. Dlatego
// liczy się SKUTECZNOŚĆ, a próg dwunastu okazji (mniej więcej dwukrotność
// średniej) pilnuje, żeby nie była to jedna szczęśliwa decyzja. Przy progu
// pięciu czoło listy zajmują wyniki w rodzaju „4 z 9".
//
// REMISY. W bazie nie ma dziś ani jednego typu z równym wynikiem ani
// meczu zakończonego remisem - sprawdzone na wszystkich 10 328 typach.
// Zabezpieczenie zostaje, bo BO2 remis dopuszcza, a mecz bez zwycięzcy
// wpadłby tu jako „nikt nie trafił", czyli jako największa niespodzianka
// w historii serwisu.

function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Rozkłada jeden wiersz meczu na to, co potrzebne do oceny niespodzianki.
 *
 * Zwraca null, gdy mecz nie ma zwycięzcy - nierozegrany, z niepełnym
 * wynikiem albo remisowy.
 */
function rozstrzygnij(row) {
  const resA = liczbaAlbo(row.res_a);
  const resB = liczbaAlbo(row.res_b);

  // Number(null) to zero, więc bez sprawdzenia na null nierozegrany mecz
  // wyglądałby na remis 0:0. To samo zabezpieczenie, co w teamStats.js.
  if (resA === null || resB === null || resA === resB) return null;

  const naA = resA > resB;

  return {
    winner: naA ? row.team_a : row.team_b,
    loser: naA ? row.team_b : row.team_a,

    // Strona zwycięzcy, a nie jego nazwa: nazwa w meczu bywa innym zapisem
    // niż ta wyświetlana ("FUT" wobec "FUT Esports"), więc porównywanie po
    // nazwie wychodzi czasem odwrotnie. Ten sam powód, co w teamStats.js.
    winnerSide: naA ? "a" : "b",

    res_a: resA,
    res_b: resB,
  };
}

/**
 * Mecze, w których społeczność się pomyliła, od najgorszego.
 *
 * @param rows      wiersze meczów z wynikiem i podziałem głosów:
 *                  id, event_name, event_slug, phase, team_a, team_b,
 *                  res_a, res_b, for_a, for_b, total
 * @param minPicks  ile typów musi mieć mecz, żeby w ogóle się liczył
 * @param thresholdPercent  do ilu procent trafień mówimy o niespodziance
 */
export function buildUpsets(
  rows,
  { minPicks = 20, thresholdPercent = 25 } = {},
) {
  const niespodzianki = [];

  for (const row of rows || []) {
    const wynik = rozstrzygnij(row);

    if (!wynik) continue;

    const typow = liczbaAlbo(row.total, 0);

    if (typow < minPicks) continue;

    const zaZwyciezca =
      wynik.winnerSide === "a"
        ? liczbaAlbo(row.for_a, 0)
        : liczbaAlbo(row.for_b, 0);

    // Procent liczony z WSZYSTKICH typów, nie z sumy wskazań obu stron.
    // Typ bez wskazania (równy wynik) nie wybiera nikogo, ale należy do
    // społeczności, która się pomyliła.
    const procent = (zaZwyciezca / typow) * 100;

    if (procent >= thresholdPercent) continue;

    niespodzianki.push({
      match_id: liczbaAlbo(row.id, 0),

      event_name: row.event_name ?? null,
      event_slug: row.event_slug ?? null,
      phase: row.phase ?? null,

      team_a: row.team_a,
      team_b: row.team_b,

      res_a: wynik.res_a,
      res_b: wynik.res_b,

      winner: wynik.winner,
      loser: wynik.loser,

      picks_total: typow,
      picks_for_winner: zaZwyciezca,

      // Zaokrąglone dopiero tutaj, a nie przy porównaniu z progiem: mecz
      // z 24.6% ma być niespodzianką, nawet jeśli pokażemy go jako 25%.
      winner_share: Math.round(procent),
    });
  }

  return niespodzianki
    .sort(
      (a, b) =>
        // Im mniej trafień, tym większa niespodzianka.
        a.picks_for_winner / a.picks_total -
          b.picks_for_winner / b.picks_total ||
        // Przy remisie decyduje, ILU ludzi się pomyliło: zero trafień wśród
        // stu czterdziestu waży więcej niż zero wśród dwudziestu.
        b.picks_total - a.picks_total ||
        a.match_id - b.match_id,
    )
    .map((m, i) => ({ rank: i + 1, ...m }));
}

/**
 * Jak często trafiał PRZECIĘTNY uczestnik tych meczów.
 *
 * To jest tło, względem którego cokolwiek znaczy skuteczność pojedynczego
 * gracza. Bez niego „trafił 42%" brzmi przeciętnie, a jest trzykrotnością
 * tego, co osiągnął ogół.
 */
export function crowdRate(upsets) {
  let typow = 0;
  let trafien = 0;

  for (const m of upsets || []) {
    typow += m.picks_total;
    trafien += m.picks_for_winner;
  }

  return typow > 0 ? Math.round((trafien / typow) * 100) : null;
}

/**
 * Kto trafia wbrew wszystkim.
 *
 * Liczy się WYŁĄCZNIE po meczach z listy niespodzianek - dlatego dostaje ją
 * gotową, zamiast wyznaczać próg po raz drugi. Dwa miejsca liczące to samo
 * rozjeżdżają się przy pierwszej zmianie progu.
 *
 * @param picks      typy z rozstrzygniętych meczów: user_id, match_id,
 *                   pred_a, pred_b
 * @param upsets     wynik buildUpsets
 * @param profiles   nazwy graczy: user_id, displayname, avatar - w kolejności
 *                   ważności źródeł, bo pierwszy wpis o danym graczu wygrywa
 * @param minChances ile okazji uprawnia do miejsca w zestawieniu
 */
export function buildContrarians(
  picks,
  upsets,
  profiles,
  { minChances = 12 } = {},
) {
  const poMeczu = new Map();

  for (const m of upsets || []) {
    // Strona zwycięzcy odtworzona z wyniku, a nie z nazwy drużyny: nazwa
    // w typie i nazwa w meczu to ten sam tekst, ale porównanie po stronie
    // jest odporne na zapis, a po nazwie nie. Ten sam powód, co wyżej.
    poMeczu.set(Number(m.match_id), {
      winnerSide: m.res_a > m.res_b ? "a" : "b",
    });
  }

  const nazwy = new Map();

  // PIERWSZE ŹRÓDŁO WYGRYWA. Nazwy przychodzą z dwóch miejsc naraz:
  // z profili (tylko ci, którzy zalogowali się na stronie - za to z awatarem)
  // i z tabel faz, gdzie bot zapisuje nick przy oddawaniu typu. Kolejność
  // ustala trasa, podając najpierw profile; gdyby zapis z faz nadpisywał
  // profil, gracz oglądałby nick sprzed roku zamiast obecnego.
  for (const p of profiles || []) {
    const userId = String(p.user_id);

    if (nazwy.has(userId)) continue;

    nazwy.set(userId, {
      displayname: p.displayname || null,
      avatar: p.avatar || null,
    });
  }

  const gracze = new Map();

  for (const p of picks || []) {
    const mecz = poMeczu.get(Number(p.match_id));

    // Typ na zwyczajny mecz nie mówi nic o chodzeniu pod prąd.
    if (!mecz) continue;

    const userId = String(p.user_id);

    if (!gracze.has(userId)) {
      gracze.set(userId, { user_id: userId, chances: 0, hits: 0 });
    }

    const g = gracze.get(userId);

    g.chances += 1;

    const predA = liczbaAlbo(p.pred_a, 0);
    const predB = liczbaAlbo(p.pred_b, 0);

    // Typ z równym wynikiem nie wskazuje nikogo, więc nie jest trafieniem -
    // ale okazją już tak, bo gracz miał ten mecz przed sobą.
    const wskazal = predA === predB ? null : predA > predB ? "a" : "b";

    if (wskazal === mecz.winnerSide) g.hits += 1;
  }

  return [...gracze.values()]
    .filter((g) => g.chances >= minChances)
    .map((g) => {
      const profil = nazwy.get(g.user_id) || {};

      return {
        user_id: g.user_id,
        displayname: profil.displayname ?? null,
        avatar: profil.avatar ?? null,

        chances: g.chances,
        hits: g.hits,

        hit_rate: Math.round((g.hits / g.chances) * 100),
      };
    })
    .sort(
      (a, b) =>
        // Skuteczność, nie liczba trafień - patrz nagłówek pliku.
        b.hit_rate - a.hit_rate ||
        // Przy równej skuteczności więcej trafień znaczy więcej dowodów.
        b.hits - a.hits ||
        (a.user_id < b.user_id ? -1 : 1),
    )
    .map((g, i) => ({ rank: i + 1, ...g }));
}

/**
 * Drużyny ułożone od najbardziej przecenianej do najbardziej niedocenianej.
 *
 * Dostaje gotowe statystyki z buildTeamStats i NIC nie liczy od nowa:
 * „zaufanie" i „procent wygranych" stoją już na stronie drużyny, a dwa
 * miejsca liczące to samo prędzej czy później pokazałyby dwie różne liczby
 * o tej samej drużynie.
 *
 * @param teams      wynik buildTeamStats
 * @param minSettled ile rozstrzygniętych meczów musi mieć drużyna
 */
export function buildMisjudged(teams, { minSettled = 5 } = {}) {
  return (teams || [])
    .filter(
      (t) =>
        t.settled >= minSettled && t.trust !== null && t.win_rate !== null,
    )
    .map((t) => ({
      key: t.key,
      name: t.name,
      logo: t.logo,

      settled: t.settled,
      wins: t.wins,
      losses: t.losses,

      trust: t.trust,
      win_rate: t.win_rate,

      // Dodatnie znaczy przeceniana: ufa się jej bardziej, niż na to
      // zasługuje. Ujemne - odwrotnie.
      gap: t.trust - t.win_rate,
    }))
    .sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
}
