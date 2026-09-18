// Czytanie wyników map: co społeczność typuje, a co naprawdę pada.
//
// NAZWY MAPY W DANYCH NIE MA i to jest pierwsza rzecz, którą trzeba
// wiedzieć. match_map_predictions i match_map_results trzymają wyłącznie
// numer mapy w serii; jedyna tabela z `map_name` - match_maps - jest pusta
// (0 wierszy). Dlatego ta strona nie mówi ani słowa o Mirage czy Nuke, bo
// nie ma na to podstawy.
//
// NUMER MAPY TEŻ NIC NIE MÓWI. Zmierzone na 18 090 rozliczonych typach:
//
//   mapa 1   9927 typów   zwycięzca 54%   dokładny 5.7%   odchylenie 6.73
//   mapa 2   6760 typów   zwycięzca 56%   dokładny 5.4%   odchylenie 6.86
//   mapa 3   1370 typów   zwycięzca 55%   dokładny 5.2%   odchylenie 6.82
//
// Mapa decydująca nie jest trudniejsza od pierwszej. To wynik pusty i nie
// ma go na stronie - cztery prawie identyczne liczby nie są informacją.
//
// CO ZOSTAJE, I TO JEST MOCNE. Społeczność typuje mapy CIAŚNIEJ, niż one
// wychodzą. Średnia typowana różnica rund to 4.74, faktyczna 5.47. Widać
// to wprost w rozkładzie: 13:9 i 13:10 to razem 40% typów, ale tylko 23%
// wyników, podczas gdy 13:5 i 13:6 to 25% rzeczywistości i 15% typów.
//
// Innymi słowy: ludzie spodziewają się wyrównanych map, a mapy bywają
// jednostronne. To jest jedno zdanie, którego serwis nigdy nie powiedział,
// choć dane na nie leżały od początku.

function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Wynik sprowadzony do postaci „wyższy:niższy”.
 *
 * Bez tego 13:9 i 9:13 byłyby dwoma różnymi wynikami, a to ten sam przebieg
 * mapy widziany z dwóch stron - pytanie brzmi „jak jednostronna była mapa”,
 * nie „która drużyna wygrała”.
 */
function ksztalt(a, b) {
  return { high: Math.max(a, b), low: Math.min(a, b) };
}

function rozklad(pary, ile) {
  const licznik = new Map();

  for (const { high, low } of pary) {
    const klucz = `${high}:${low}`;

    licznik.set(klucz, (licznik.get(klucz) ?? 0) + 1);
  }

  const wszystkich = pary.length;

  return [...licznik.entries()]
    .map(([klucz, count]) => {
      const [high, low] = klucz.split(":").map(Number);

      return {
        high,
        low,
        count,
        share: wszystkich > 0 ? Math.round((count / wszystkich) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.low - b.low)
    .slice(0, ile);
}

function srednia(liczby) {
  if (liczby.length === 0) return null;

  const suma = liczby.reduce((s, n) => s + n, 0);

  return Math.round((suma / liczby.length) * 100) / 100;
}

/**
 * Wszystko, co da się powiedzieć o czytaniu map, z jednego zestawu wierszy.
 *
 * Wiersze to typy POŁĄCZONE z wynikiem, więc każdy niesie i to, co gracz
 * obstawił, i to, co padło. Rozkład wyników faktycznych powstaje z tych
 * samych wierszy po odsianiu duplikatów - jedna mapa ma tylu typujących,
 * ilu ją obstawiło, a do rozkładu ma wejść raz.
 *
 * @param rows     match_id, map_no, user_id, pred_exact_a, pred_exact_b,
 *                 exact_a, exact_b
 * @param profiles nazwy graczy w kolejności ważności źródeł
 * @param minPicks ile rozliczonych typów uprawnia do miejsca w zestawieniu
 * @param topScores ile najczęstszych wyników pokazać w każdym rozkładzie
 */
export function buildMapReading(
  rows,
  profiles,
  { minPicks = 30, topScores = 8 } = {},
) {
  const typowane = [];
  const mapy = new Map();

  const gracze = new Map();

  for (const r of rows || []) {
    const predA = liczbaAlbo(r.pred_exact_a);
    const predB = liczbaAlbo(r.pred_exact_b);
    const resA = liczbaAlbo(r.exact_a);
    const resB = liczbaAlbo(r.exact_b);

    // Niepełny typ albo niepełny wynik nie mówi nic - i nie może wchodzić
    // do średniej jako zero.
    if (predA === null || predB === null || resA === null || resB === null) {
      continue;
    }

    typowane.push(ksztalt(predA, predB));

    // Mapa do rozkładu faktycznego trafia RAZ, niezależnie od tego, ilu
    // graczy ją obstawiło. Inaczej mapa z setką typujących ważyłaby sto
    // razy więcej niż mapa z jednym.
    const kluczMapy = `${r.match_id}:${r.map_no}`;

    if (!mapy.has(kluczMapy)) mapy.set(kluczMapy, ksztalt(resA, resB));

    const userId = String(r.user_id);

    if (!gracze.has(userId)) {
      gracze.set(userId, { user_id: userId, picks: 0, exact: 0, winners: 0, odchylenieSuma: 0 });
    }

    const g = gracze.get(userId);

    g.picks += 1;
    g.odchylenieSuma += Math.abs(predA - resA) + Math.abs(predB - resB);

    if (predA === resA && predB === resB) g.exact += 1;

    // Zwycięzca mapy to warunek wstępny w punktacji serwisu: bez niego
    // bliski wynik nie daje nic. Dlatego jedzie jako osobna liczba obok
    // odchylenia, a nie zamiast niego.
    if ((predA > predB && resA > resB) || (predB > predA && resB > resA)) {
      g.winners += 1;
    }
  }

  const faktyczne = [...mapy.values()];

  const nazwy = new Map();

  // Pierwsze źródło wygrywa - tak samo jak w niespodziankach, i z tego
  // samego powodu: profil niesie awatar i jest odświeżany przy logowaniu,
  // a zapis z fazy pamięta nick z dnia typowania.
  for (const p of profiles || []) {
    const userId = String(p.user_id);

    if (nazwy.has(userId)) continue;

    nazwy.set(userId, {
      displayname: p.displayname || null,
      avatar: p.avatar || null,
    });
  }

  const readers = [...gracze.values()]
    .filter((g) => g.picks >= minPicks)
    .map((g) => {
      const profil = nazwy.get(g.user_id) || {};

      return {
        user_id: g.user_id,
        displayname: profil.displayname ?? null,
        avatar: profil.avatar ?? null,

        picks: g.picks,
        exact: g.exact,

        winner_rate: Math.round((g.winners / g.picks) * 100),

        // Średnie łączne odchylenie od wyniku - dokładnie ta miara, na
        // której stoi punktacja map w tym serwisie. Mniej znaczy lepiej.
        deviation: Math.round((g.odchylenieSuma / g.picks) * 100) / 100,
      };
    })
    .sort(
      (a, b) =>
        a.deviation - b.deviation ||
        b.exact - a.exact ||
        (a.user_id < b.user_id ? -1 : 1),
    )
    .map((g, i) => ({ rank: i + 1, ...g }));

  return {
    settled_picks: typowane.length,
    settled_maps: faktyczne.length,
    players: gracze.size,

    // Sedno tej strony: dwie liczby obok siebie.
    avg_predicted_gap: srednia(typowane.map((w) => w.high - w.low)),
    avg_actual_gap: srednia(faktyczne.map((w) => w.high - w.low)),

    predicted: rozklad(typowane, topScores),
    actual: rozklad(faktyczne, topScores),

    readers,
  };
}
