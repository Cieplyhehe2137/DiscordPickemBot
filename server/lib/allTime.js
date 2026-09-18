// Klasyfikacja wszech czasów: kto typuje najlepiej przez cały czas istnienia
// serwisu, a nie w pojedynczym turnieju.
//
// DLACZEGO NIE SUMA PUNKTÓW. Bo punkty z różnych turniejów są nieporównywalne
// i nie chodzi o drobną różnicę. Zmierzone na produkcji:
//
//   IEM Cologne Major 2026    523 graczy   106 meczów   max 316 pkt
//   StarLadder Budapest 2025  509 graczy     0 meczów   max  47 pkt
//   IEM Kraków 2026           262 graczy    50 meczów   max 156 pkt
//
// Budapeszt miał same typy faz, bez meczów, więc dorobek jest tam siedem razy
// mniejszy. Ranking z sumy punktów byłby rankingiem tego, KTO GRAŁ W COLOGNE:
// zwycięzca Budapesztu z 47 punktami stałby niżej niż ktoś z dwusetnego
// miejsca w Cologne. Nagradzałby frekwencję i trafienie na duży turniej,
// a nie skuteczność.
//
// CO JEST PORÓWNYWALNE: miejsce w stawce. „Piąty z 523" i „piąty z 262" to
// ten sam wynik, mimo że punkty mówią co innego. Dlatego klasyfikacja stoi na
// średnim percentylu - tej samej liczbie, którą profil gracza pokazuje przy
// każdym starcie jako „TOP x%".
//
// DLACZEGO OD DWÓCH STARTÓW. Bez progu czołówkę zajmują jednorazowi gracze:
// w prawdziwych danych pierwsza dwunastka to sami ludzie z jednym startem,
// pięciu z nich ma identyczne „TOP 1%", a o kolejności decyduje rozstrzygnięcie
// remisu. Stoi tam ktoś z 43 punktami nad ludźmi z trzystoma. Przy progu dwóch
// startów tabela robi się tym, czym ma być: 164 osoby z porównywalnym
// dorobkiem, a ci z trzema startami wchodzą do czołówki sami, bez ulg.
//
// Nikogo to nie wyklucza na stałe - do wejścia brakuje jednego turnieju.
// Strona ma to powiedzieć wprost, zamiast po cichu pomijać 85% graczy.

function liczbaAlbo(wartosc, zapasowa = 0) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Górny procent stawki dla jednego startu.
 *
 * Ta sama formuła, co w playerHistory.js - i to nie jest przypadek. Gracz
 * widzi „TOP 3%" na swoim profilu i ta sama liczba ma stać za jego miejscem
 * w klasyfikacji. Dwie formuły dałyby dwie prawdy o tym samym starcie.
 */
export function topPercent(rank, total) {
  if (!(rank > 0) || !(total > 0)) return null;

  return Math.max(1, Math.ceil((rank / total) * 100));
}

/**
 * Układa wiersze klasyfikacji turniejowych w klasyfikację wszech czasów.
 *
 * Funkcja jest czysta i dostaje gotowe wiersze, bo cała trudność tego
 * rankingu jest w regule, a nie w pobraniu danych - i regułę da się dzięki
 * temu sprawdzić testem bez bazy.
 *
 * @param rows      wiersze: user_id, event_id, name, slug, rank_position,
 *                  uczestnicy, total_points, displayname, avatar
 * @param minStarts ile startów uprawnia do miejsca w tabeli
 */
export function buildAllTime(rows, { minStarts = 2 } = {}) {
  const gracze = new Map();

  for (const r of rows || []) {
    const userId = String(r.user_id);

    const miejsce = liczbaAlbo(r.rank_position, 0);
    const stawka = liczbaAlbo(r.uczestnicy, 0);

    const percent = topPercent(miejsce, stawka);

    // Start bez miejsca nie mówi nic o skuteczności i nie może obniżać ani
    // podnosić średniej. Zdarza się przy turnieju bez ani jednego punktu.
    if (percent === null) continue;

    if (!gracze.has(userId)) {
      gracze.set(userId, {
        user_id: userId,
        displayname: r.displayname || null,
        avatar: r.avatar || null,
        starts: 0,
        percentSum: 0,
        total_points: 0,
        best: null,
      });
    }

    const g = gracze.get(userId);

    g.starts += 1;
    g.percentSum += percent;
    g.total_points += liczbaAlbo(r.total_points, 0);

    // Najlepszy start liczony po MIEJSCU W STAWCE, nie po punktach: to ta
    // sama miara, na której stoi cała tabela.
    if (!g.best || percent < g.best.top_percent) {
      g.best = {
        event_id: liczbaAlbo(r.event_id, 0),
        name: r.name ?? null,
        slug: r.slug ?? null,
        rank: miejsce,
        participants: stawka,
        top_percent: percent,
      };
    }
  }

  return [...gracze.values()]
    .filter((g) => g.starts >= minStarts)
    .map((g) => ({
      user_id: g.user_id,
      displayname: g.displayname,
      avatar: g.avatar,

      starts: g.starts,

      // Jedna miejsce po przecinku: średnia z dwóch startów i tak daje
      // połówki, a druga cyfra udawałaby dokładność, której tu nie ma.
      avg_top_percent: Math.round((g.percentSum / g.starts) * 10) / 10,

      // Punkty są KONTEKSTEM, nie podstawą kolejności - patrz nagłówek.
      total_points: g.total_points,

      best: g.best,
    }))
    .sort(
      (a, b) =>
        // Niżej znaczy lepiej: TOP 3% bije TOP 10%.
        a.avg_top_percent - b.avg_top_percent ||
        // Przy remisie wygrywa ten, kto utrzymał poziom dłużej.
        b.starts - a.starts ||
        // Potem pojedynczy najlepszy wynik.
        a.best.rank - b.best.rank ||
        // Na końcu identyfikator - żeby kolejność była powtarzalna, tak samo
        // jak w klasyfikacji pojedynczego turnieju.
        (a.user_id < b.user_id ? -1 : 1),
    )
    .map((g, i) => ({ rank: i + 1, ...g }));
}
