// Dostawca map: CitoAPI.
//
// CO TU JEST. Czysta czesc: budowanie zadania, parowanie ICH meczu z NASZYM
// i przelozenie ich pickTeamId na nasze TEAM_A / TEAM_B. Samo wolanie sieci
// stoi w scripts/fetchMatchMaps.mjs.
//
// DLACZEGO CITO, A NIE PANDASCORE ANI LIQUIPEDIA. Sprawdzone na zywym API:
//
//   PandaScore  mapy sa dopiero w planie "Historical & Post-Match",
//               od 400 EUR miesiecznie za jedna gre. Na darmowym planie
//               obiekt gry nie ma klucza `map` w ogole - 90 gier w 50
//               ostatnich meczach CS, zero trafien, a /csgo/games/{id}
//               oddaje 403.
//
//   Liquipedia  darmowa dla niekomercyjnych serwisow, ale wymaga wniosku
//               o klucz, a ksztaltu odpowiedzi nie dalo sie potwierdzic
//               przed jego otrzymaniem.
//
//   Cito        darmowy plan 500 zapytan na miesiac, klucz od reki,
//               i - sprawdzone na NASZYM turnieju - jedno zapytanie
//               o event zwraca 41 meczow i 125 map z informacja, kto je
//               wypickowal.
//
// BUDZET. Mapy przychodza W LISCIE meczow eventu, wiec cala synchronizacja
// turnieju to JEDNO zapytanie, nie jedno na mecz. Przy 42 meczach to roznica
// miedzy 1 a 42 z limitu 500 na miesiac.
//
// ATRYBUCJA. Ich regulamin: "You may display data obtained from our API in
// your applications with proper attribution". Stad napis przy mapach na
// stronie meczu. Redystrybucja danych jako feed jest u nich zabroniona -
// my ich tylko pokazujemy we wlasnym serwisie, co regulamin dopuszcza.

import { teamKey } from "../teamLogos.js";

/** Nazwa dostawcy - ta sama trafia do kolumny `source` w match_maps. */
export const ZRODLO = "cito";

/** Darmowy plan: 500 zapytan na MIESIAC. Zostawiamy zapas. */
export const LIMIT_NA_MIESIAC = 450;

const API = "https://api.citoapi.com/api/v1";

/**
 * Zadanie o wszystkie mecze turnieju - z mapami w srodku.
 *
 * Zwraca { url, headers } bez wolania sieci, zeby dalo sie sprawdzic
 * testem, ze klucz NIE wyladowal w adresie.
 */
export function buildEventMatchesRequest({ key, eventId, limit = 100 } = {}) {
  if (!key || typeof key !== "string") {
    return { ok: false, reason: "Brak klucza CitoAPI." };
  }

  if (!eventId || typeof eventId !== "string") {
    return { ok: false, reason: "Brak identyfikatora turnieju u dostawcy." };
  }

  const url = new URL(
    `${API}/cs2/events/${encodeURIComponent(eventId)}/matches`,
  );

  url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 100)));

  return {
    ok: true,
    url: url.toString(),

    headers: {
      // Klucz TYLKO tutaj. W adresie wyladowalby w logach posrednikow
      // i w historii przegladarki.
      "x-api-key": key,
      Accept: "application/json",
    },
  };
}

/** Lista meczow z odpowiedzi - oni pakuja ja w `data`. */
export function extractMatches(odpowiedz) {
  const dane = odpowiedz?.data ?? odpowiedz;

  if (Array.isArray(dane)) return dane;

  if (Array.isArray(dane?.matches)) return dane.matches;

  return [];
}

/*
 * KLUCZE do parowania - zestaw na druzyne, nie jeden napis.
 *
 * Dwa niezalezne sposoby sprowadzenia nazwy do wspolnej postaci, kazdy
 * obsluguje inne przypadki:
 *
 *   teamKey()      - recznie kurowana tablica scalen, w ktorej kazdy wpis ma
 *                    zmierzony powod ("NAVI wystepuje 555 razy, Natus
 *                    Vincere trzy"). Zalatwia "Natus Vincere" = "NAVI".
 *
 *   bez ozdobnikow - zdjecie slow organizacyjnych. Zalatwia "Team Vitality"
 *                    = "Vitality", czyli przypadki, w ktorych CUDZY serwis
 *                    skraca nazwe inaczej niz my.
 *
 * Samo zdjecie ozdobnikow PSUJE pierwsza rodzine, bo omija tablice scalen.
 * Dlatego liczy sie czesc wspolna zestawow, a nie rownosc kluczy.
 */
const OZDOBNIKI = /\b(team|esports|esport|gaming|clan|academy|org)\b/g;

function kluczeNazwy(nazwa) {
  const zestaw = new Set();

  const pelny = teamKey(nazwa);

  if (pelny) zestaw.add(pelny);

  const bezOzdobnikow = String(nazwa || "")
    .toLowerCase()
    .replace(OZDOBNIKI, " ")
    .replace(/[^a-z0-9]/g, "");

  // Zdjecie ozdobnikow nie moze zjesc calej nazwy - "Team Esports" ma
  // zostac soba, a nie pustym napisem pasujacym do wszystkiego.
  if (bezOzdobnikow.length >= 2) {
    zestaw.add(bezOzdobnikow);

    const scalony = teamKey(bezOzdobnikow);

    if (scalony) zestaw.add(scalony);
  }

  return zestaw;
}

function majaCzescWspolna(a, b) {
  for (const k of a) {
    if (b.has(k)) return true;
  }

  return false;
}

/** Ile minut roznicy startu jeszcze uznajemy za ten sam mecz. */
export const OKNO_MINUT = 150;

function naMilisekundy(wartosc) {
  if (!wartosc) return null;

  const tekst = String(wartosc).trim();

  // Nasza kolumna to "2026-10-11 15:00:00" (UTC bez strefy), ich pole to
  // pelne ISO. Obie postaci maja znaczyc UTC.
  const zStrefa = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(tekst)
    ? tekst
    : `${tekst.replace(" ", "T")}Z`;

  const ms = new Date(zStrefa).getTime();

  return Number.isFinite(ms) ? ms : null;
}

/**
 * Czy ten rekord dostawcy to NASZ mecz.
 *
 * Para musi zgadzac sie na DWA sposoby naraz: obie druzyny i godzina
 * w rozsadnym oknie. Sama nazwa nie wystarcza, bo te same dwie druzyny graja
 * ze soba kilka razy w sezonie; sama godzina tym bardziej, bo o 15:00 gra
 * polowa turnieju.
 *
 * Zmierzone: ich mecz #39 zaczal sie 10 minut po naszej zapowiedzi, wiec
 * okno musi byc wyrazne - poprzedni mecz sie przeciaga i cala plansza
 * przesuwa.
 */
function obieDruzynyPasuja(nasz, rekord) {
  if (!nasz || !rekord) return { ok: false, reason: "brak danych" };

  const nasze = [nasz.team_a, nasz.team_b].map((n) => kluczeNazwy(n));

  if (nasze.some((z) => z.size === 0)) {
    return { ok: false, reason: "nasze nazwy druzyn puste" };
  }

  const ich = [rekord.team1Name, rekord.team2Name]
    .filter(Boolean)
    .map((n) => kluczeNazwy(n));

  // Kazda z NASZYCH dwoch druzyn musi znalezc WLASNA druzyne po ich stronie.
  // Bez tego jedna nazwa dopasowalaby sie dwa razy i mecz "Vitality vs
  // Vitality Academy" uchodzilby za nasz.
  const zajete = new Set();
  let dopasowanych = 0;

  for (const nasza of nasze) {
    const trafienie = ich.findIndex(
      (ichNazwa, idx) => !zajete.has(idx) && majaCzescWspolna(nasza, ichNazwa),
    );

    if (trafienie !== -1) {
      zajete.add(trafienie);
      dopasowanych += 1;
    }
  }

  if (dopasowanych < 2) {
    return { ok: false, reason: `druzyny sie nie zgadzaja (${dopasowanych}/2)` };
  }

  return { ok: true };
}

/**
 * Czy ten JEDEN rekord to nasz mecz - obie druzyny i godzina w oknie.
 *
 * Scisla wersja, uzywana tam, gdzie porownujemy pojedyncza pare. Wybor
 * sposrod wielu rekordow idzie przez findRecordForMatch, ktory wie, kiedy
 * godzina w ogole cos rozroznia.
 */
export function matchesOurMatch({ nasz, rekord, oknoMinut = OKNO_MINUT } = {}) {
  const druzyny = obieDruzynyPasuja(nasz, rekord);

  if (!druzyny.ok) return druzyny;

  const naszCzas = naMilisekundy(nasz.start_time_utc);
  const ichCzas = naMilisekundy(rekord.startsAt);

  if (naszCzas === null || ichCzas === null) {
    return { ok: false, reason: "brak godziny po ktorejs stronie" };
  }

  const roznicaMinut = Math.abs(naszCzas - ichCzas) / 60000;

  if (roznicaMinut > oknoMinut) {
    return {
      ok: false,
      reason: `godziny odlegle o ${Math.round(roznicaMinut)} min`,
    };
  }

  return { ok: true, roznicaMinut: Math.round(roznicaMinut) };
}

/** Gorna granica zdrowego rozsadku, gdy kandydat jest tylko jeden. */
export const DOBA_MINUT = 24 * 60;

/**
 * Znajduje ICH rekord odpowiadajacy NASZEMU meczowi.
 *
 * GODZINA ROZSTRZYGA TYLKO WTEDY, GDY JEST CO ROZSTRZYGAC.
 *
 * Pierwsza wersja wymagala obu druzyn I godziny w oknie 150 minut. Na
 * produkcji odrzucilo to 4 mecze z 41, ktore dostawca ma razem z mapami -
 * roznice wyniosly 155, 175, 185 i 205 minut. Mecze zaczynaja sie
 * z opoznieniem, bo poprzednie na tej samej scenie sie przeciagaja, i nie
 * ma gornej granicy tego poslizgu.
 *
 * Samo rozszerzenie okna byloby slepe. Przed czym okno w ogole chroni?
 * Przed pomyleniem DWOCH SPOTKAN TYCH SAMYCH DRUZYN. Zmierzone w tym
 * turnieju: 39 par na 41 meczow jest unikalnych, a dwa razy ze soba graja
 * tylko "FURIA + MOUZ" i "MOUZ + Spirit".
 *
 * Czyli:
 *   - jeden kandydat  -> nie ma czego mylic, godzina tylko pilnuje, zeby
 *                        nie sparowac meczu sprzed miesiaca (doba zapasu);
 *   - kilku kandydatow -> godzina jest jedyna rzecza, ktora ich rozroznia,
 *                        wiec bierzemy najblizszego i musi zmiescic sie
 *                        w waskim oknie.
 */
export function findRecordForMatch({
  nasz,
  rekordy,
  oknoMinut = OKNO_MINUT,
} = {}) {
  if (!nasz || !Array.isArray(rekordy)) {
    return { ok: false, reason: "brak danych" };
  }

  const kandydaci = rekordy.filter(
    (rekord) => obieDruzynyPasuja(nasz, rekord).ok,
  );

  if (!kandydaci.length) {
    return { ok: false, reason: "nie znaleziono meczu tych druzyn" };
  }

  const naszCzas = naMilisekundy(nasz.start_time_utc);

  const zRoznica = kandydaci.map((rekord) => {
    const ichCzas = naMilisekundy(rekord.startsAt);

    return {
      rekord,
      roznicaMinut:
        naszCzas === null || ichCzas === null
          ? null
          : Math.abs(naszCzas - ichCzas) / 60000,
    };
  });

  if (zRoznica.length === 1) {
    const [jedyny] = zRoznica;

    // Brak godziny po ktorejs stronie przy JEDNYM kandydacie nie jest
    // powodem do odrzucenia - te dwie druzyny zagraly ze soba w tym
    // turnieju raz i nie ma z czym tego pomylic.
    if (jedyny.roznicaMinut === null || jedyny.roznicaMinut <= DOBA_MINUT) {
      return {
        ok: true,
        rekord: jedyny.rekord,
        roznicaMinut:
          jedyny.roznicaMinut === null ? null : Math.round(jedyny.roznicaMinut),
        jedyny: true,
      };
    }

    return {
      ok: false,
      reason: `jedyny kandydat odlegly o ${Math.round(jedyny.roznicaMinut / 60)} h`,
    };
  }

  // Kilku kandydatow - tu godzina jest jedyna rzecza, ktora ich rozroznia.
  const zCzasem = zRoznica.filter((k) => k.roznicaMinut !== null);

  if (!zCzasem.length) {
    return {
      ok: false,
      reason: `${kandydaci.length} spotkan tych druzyn i zadnej godziny`,
    };
  }

  zCzasem.sort((a, b) => a.roznicaMinut - b.roznicaMinut);

  const [najblizszy] = zCzasem;

  if (najblizszy.roznicaMinut > oknoMinut) {
    return {
      ok: false,
      reason:
        `${kandydaci.length} spotkan tych druzyn, najblizsze o ` +
        `${Math.round(najblizszy.roznicaMinut)} min`,
    };
  }

  return {
    ok: true,
    rekord: najblizszy.rekord,
    roznicaMinut: Math.round(najblizszy.roznicaMinut),
    jedyny: false,
  };
}

/**
 * Mapy ich meczu przelozone na NASZE strony.
 *
 * TO JEST SEDNO TEGO PLIKU. Oni podaja `pickTeamId`, czyli identyfikator
 * w ICH bazie, a kolejnosc druzyn u nich NIE MUSI byc nasza - sprawdzone:
 * nasz mecz #39 to "Spirit vs MOUZ", a u nich team1 to MOUZ. Gdyby
 * przepisac pickera wprost, polowa pickow trafilaby do zlej druzyny.
 *
 * Dlatego najpierw ustalamy, ktory ICH identyfikator odpowiada NASZEJ
 * team_a, i dopiero wtedy tlumaczymy.
 *
 * `pickTeamId === null` znaczy decider - zmierzone: 41 takich na 125 map,
 * czyli dokladnie po jednej na mecz.
 *
 * Zwraca { names, pickers } o rownej dlugosci, gotowe dla buildMatchMaps.
 */
export function mapsForOurMatch({ nasz, rekord } = {}) {
  const puste = { names: [], pickers: [] };

  if (!nasz || !rekord || !Array.isArray(rekord.maps)) return puste;

  const kluczeNaszejA = kluczeNazwy(nasz.team_a);

  // Ktory ich identyfikator to nasza druzyna A.
  const idNaszejA = majaCzescWspolna(kluczeNaszejA, kluczeNazwy(rekord.team1Name))
    ? rekord.team1Id
    : rekord.team2Id;

  const idNaszejB = idNaszejA === rekord.team1Id ? rekord.team2Id : rekord.team1Id;

  const posortowane = [...rekord.maps].sort(
    (a, b) => Number(a?.mapNumber || 0) - Number(b?.mapNumber || 0),
  );

  const names = [];
  const pickers = [];

  for (const mapa of posortowane) {
    const numer = Number(mapa?.mapNumber);

    if (!Number.isInteger(numer) || numer < 1) continue;

    // Dziura w numeracji musi zostac dziura - inaczej mapa trzecia
    // zapisalaby sie jako druga i wynik trafilby pod zly numer.
    while (names.length < numer - 1) {
      names.push(null);
      pickers.push(null);
    }

    names[numer - 1] = mapa?.mapName ?? null;

    pickers[numer - 1] =
      mapa?.pickTeamId == null
        ? "DECIDER"
        : mapa.pickTeamId === idNaszejA
          ? "TEAM_A"
          : mapa.pickTeamId === idNaszejB
            ? "TEAM_B"
            : null;
  }

  return { names, pickers };
}
