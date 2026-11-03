// Czołówka klasyfikacji turnieju - pobrana z WŁASNEGO API, nie policzona tu.
//
// DLACZEGO NIE ZAPYTANIE DO BAZY, skoro bot ma do niej dostęp. Bo ranking nie
// układa się po samych punktach. Serwis sortuje go po TRZECH kluczach:
//
//   total_points DESC, correct_winners DESC, lb.user_id ASC
//
// a `correct_winners` dochodzi z osobnego podzapytania o statystyki meczowe.
// Zapytanie "ORDER BY total_points" w bocie wyglądałoby na to samo i dawałoby
// inną czołówkę przy remisie.
//
// To nie jest obawa teoretyczna. IEM Kraków 2026, stan z produkcji: miejsce
// pierwsze i drugie mają PO 156 PUNKTÓW i rozdziela je dopiero liczba
// trafionych zwycięzców. Bot sortujący po punktach ogłosiłby zwycięzcą kogoś
// innego, niż pokazuje strona - i nic by tego nie zgłosiło.
//
// Dlatego źródło jest jedno: ta sama trasa, z której czyta strona. Nazwy
// graczy też, razem z jej łańcuchem zapasów (profil, potem typy faz, na końcu
// identyfikator) - inaczej trzeba by go tu powtórzyć.
//
// Koszt: jedno żądanie HTTP w chwili kończenia turnieju i zależność od tego,
// czy API odpowiada. Wołający traktuje null jako "nie ma czego wysłać" i nie
// przerywa z tego powodu kończenia turnieju.
//
// fetchImpl wstrzykiwane tak samo jak w utils/resultProviders/pandascore.js -
// żeby dało się to sprawdzić bez sieci.

const { logWarn } = require("./logger");

const DOMYSLNY_TIMEOUT_MS = 10_000;

/**
 * @returns {Promise<null|{players:number, matches:number,
 *                        podium:Array<{rank:number, name:string,
 *                                      userId:string, points:number}>}>}
 */
async function fetchTournamentStandings({
  apiBaseUrl,
  eventSlug,
  top = 3,
  fetchImpl = fetch,
  timeoutMs = DOMYSLNY_TIMEOUT_MS,
} = {}) {
  const base = String(apiBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  const slug = String(eventSlug || "").trim();

  if (!base || !slug) return null;

  const url = `${base}/api/events/${encodeURIComponent(slug)}/leaderboard`;

  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res?.ok) {
      logWarn("recap", "API rankingu odpowiedziało błędem", {
        slug,
        status: res?.status,
      });

      return null;
    }

    const dane = await res.json();

    const wiersze = Array.isArray(dane?.leaderboard) ? dane.leaderboard : [];

    // `uczestnicy` to ta sama liczba, którą strona pisze nad tabelą. Zapas
    // z liczby wierszy w rankingu, gdyby trasa kiedyś przestała ją podawać.
    const players = Number(dane?.uczestnicy ?? dane?.strony?.wRankingu ?? 0);

    return {
      players: Number.isFinite(players) ? players : 0,
      matches: Number(dane?.meczow || 0),

      // Kolejność z odpowiedzi, BEZ ponownego sortowania - to jest cały sens
      // pytania API zamiast bazy. `rank` idzie z serwisu razem z remisami.
      podium: wiersze.slice(0, Math.max(0, Number(top) || 0)).map((r) => ({
        rank: Number(r?.rank || 0),
        name: String(r?.displayname || r?.user_id || "?"),
        userId: String(r?.user_id || ""),
        points: Number(r?.total_points || 0),
      })),
    };
  } catch (err) {
    logWarn("recap", "Nie udało się pobrać rankingu z API", {
      slug,
      message: err?.message,
    });

    return null;
  }
}

module.exports = { fetchTournamentStandings };
