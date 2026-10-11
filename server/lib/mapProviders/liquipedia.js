// Dostawca map: Liquipedia (LPDB API v3).
//
// CO TU JEST, A CZEGO NIE MA. Tu jest CZYSTA czesc: budowanie zadania,
// wyciaganie nazw map z rekordu i parowanie rekordu z naszym meczem.
// Samo wolanie sieci stoi w scripts/fetchMatchMaps.mjs - dzieki temu cala
// logika, ktora moze sie pomylic, ma testy bez dotykania API.
//
// ===========================================================================
// KSZTALT ODPOWIEDZI JEST NIEZWERYFIKOWANY i trzeba o tym wiedziec.
//
// Liquipedia udostepnia szczegolowa dokumentacje LPDB dopiero po przyznaniu
// klucza, a dostepu do ich stron HTML regulamin zabrania (i serwer odrzuca
// automatyczne zapytania - sprawdzone, HTTP 403). Nie bylo wiec jak zobaczyc
// prawdziwego rekordu meczu CS przed napisaniem tego pliku.
//
// Dlatego `extractMapsFromMatch` czyta TOLERANCYJNIE: zaglada w kilka
// prawdopodobnych miejsc i bierze pierwsze, ktore wyglada sensownie, zamiast
// zakladac jedna sciezke. A skrypt domyslnie NIC NIE ZAPISUJE - pokazuje, co
// znalazl, i odklada surowa odpowiedz do pliku, zeby dalo sie te sciezki
// potwierdzic albo poprawic na prawdziwych danych.
//
// Gdy juz zobaczymy prawdziwy rekord: dopisac fikstura do
// test/liquipediaMaps.test.js i zwezic te sciezki do tej jednej, ktora
// naprawde wystepuje.
// ===========================================================================
//
// WARUNKI KORZYSTANIA, ktore ten plik musi spelniac (regulamin API
// Liquipedii - to nie sa nasze preferencje, tylko ich wymagania):
//
//   - klucz idzie naglowkiem "Authorization: Apikey <klucz>", NIGDY w adresie;
//   - wlasny User-Agent, ktory mowi, kto pyta;
//   - najwyzej 60 zapytan na godzine do LPDB;
//   - wyniki trzeba buforowac i nie pytac dwa razy o to samo;
//   - dane sa na CC-BY-SA 3.0, wiec na stronie musi byc widoczne zrodlo;
//   - czytanie stron HTML zamiast API jest zabronione.

import { teamKey } from "../teamLogos.js";

/** Nazwa dostawcy - ta sama trafia do kolumny `source` w match_maps. */
export const ZRODLO = "liquipedia";

/** Ich limit to 60 zapytan na godzine. Zostawiamy zapas na powtorke. */
export const LIMIT_NA_GODZINE = 50;

const API = "https://api.liquipedia.net/api/v3/";

/**
 * Sklada zadanie do LPDB.
 *
 * Zwraca { url, headers } - bez wolania sieci, zeby dalo sie sprawdzic
 * testem, ze klucz NIE wyladowal w adresie i ze naglowki sa zgodne
 * z regulaminem.
 */
export function buildLpdbRequest({
  key,
  datapoint = "match",
  wiki = "counterstrike",
  conditions = "",
  limit = 50,
  offset = 0,
  query = "",
} = {}) {
  if (!key || typeof key !== "string") {
    return { ok: false, reason: "Brak klucza API Liquipedii." };
  }

  const url = new URL(datapoint, API);

  url.searchParams.set("wiki", wiki);
  url.searchParams.set("limit", String(Math.min(Number(limit) || 50, 1000)));

  if (offset) url.searchParams.set("offset", String(offset));
  if (conditions) url.searchParams.set("conditions", conditions);
  if (query) url.searchParams.set("query", query);

  return {
    ok: true,
    url: url.toString(),

    headers: {
      // Klucz TYLKO tutaj. W adresie wyladowalby w logach posrednikow
      // i w historii, a regulamin zabrania dzielenia sie kluczem.
      Authorization: `Apikey ${key}`,

      // Wlasny User-Agent jest u nich wymagany - anonimowe zapytania
      // sa odrzucane.
      "User-Agent": "PickEmBot/1.0 (+https://pickembot.pl)",

      Accept: "application/json",
    },
  };
}

/*
 * Sciezki, pod ktorymi moze lezec lista gier w rekordzie meczu.
 *
 * NIEZWERYFIKOWANE - patrz naglowek pliku. Kolejnosc ma znaczenie: bierzemy
 * pierwsza, ktora da jakiekolwiek nazwy.
 */
const SCIEZKI_GIER = [
  (r) => r?.match2games,
  (r) => r?.games,
  (r) => r?.maps,
  (r) => r?.extradata?.games,
];

/*
 * Pola, pod ktorymi moze lezec nazwa mapy w pojedynczej grze.
 * Rowniez niezweryfikowane.
 */
const POLA_MAPY = [
  (g) => g?.map,
  (g) => g?.mapname,
  (g) => g?.map_name,
  (g) => g?.extradata?.map,
  (g) => (typeof g === "string" ? g : null),
];

function pierwszaNiepusta(zrodla, wejscie) {
  for (const we of zrodla) {
    let wynik = null;

    try {
      wynik = we(wejscie);
    } catch {
      wynik = null;
    }

    if (wynik !== null && wynik !== undefined && wynik !== "") return wynik;
  }

  return null;
}

/**
 * Wyciaga nazwy map z rekordu meczu, w kolejnosci rozgrywania.
 *
 * Zwraca { names, found, path } - `path` mowi, ktora sciezka zadzialala,
 * zeby dalo sie to zobaczyc w podgladzie i potem zwezic kod.
 *
 * Nazwy NIE sa tu ujednolicane - robi to lib/matchMaps.js, wspolnie dla
 * wpisu recznego i dla dostawcy.
 */
export function extractMapsFromMatch(rekord) {
  const pusto = { names: [], found: false, path: null };

  if (!rekord || typeof rekord !== "object") return pusto;

  for (let i = 0; i < SCIEZKI_GIER.length; i += 1) {
    let gry = null;

    try {
      gry = SCIEZKI_GIER[i](rekord);
    } catch {
      gry = null;
    }

    if (!Array.isArray(gry) || !gry.length) continue;

    const names = gry.map((g) => {
      const nazwa = pierwszaNiepusta(POLA_MAPY, g);

      return typeof nazwa === "string" ? nazwa : null;
    });

    // Sama tablica gier bez ani jednej nazwy to nie jest trafienie -
    // probujemy nastepnej sciezki.
    if (names.some((n) => n)) {
      return { names, found: true, path: `sciezka#${i}` };
    }
  }

  return pusto;
}

/** Ile minut roznicy startu jeszcze uznajemy za ten sam mecz. */
export const OKNO_MINUT = 150;

function naMilisekundy(wartosc) {
  if (!wartosc) return null;

  // LPDB podaje czas jako "2026-10-11 15:00:00" (UTC, bez strefy) albo ISO.
  const tekst = String(wartosc).trim();

  const zStrefa = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(tekst)
    ? tekst
    : `${tekst.replace(" ", "T")}Z`;

  const ms = new Date(zStrefa).getTime();

  return Number.isFinite(ms) ? ms : null;
}

/*
 * KLUCZE do parowania meczu - zestaw na druzyne, nie jeden napis.
 *
 * Dlaczego zestaw, a nie pojedynczy klucz. Mamy dwa niezalezne sposoby
 * sprowadzenia nazwy do wspolnej postaci i KAZDY z nich obsluguje inne
 * przypadki:
 *
 *   teamKey()      - recznie kurowana tablica scalen, w ktorej kazdy wpis ma
 *                    zmierzony powod ("NAVI wystepuje 555 razy, Natus
 *                    Vincere trzy"). Zalatwia "Natus Vincere" = "NAVI"
 *                    i "FaZe Clan" = "FaZe". Nie dopisuje sie do niej na
 *                    wyczucie, bo na tych kluczach stoja adresy /teams/...
 *                    i wiersze w team_logos.
 *
 *   bez ozdobnikow - zdjecie slow organizacyjnych. Zalatwia "Team Vitality"
 *                    = "Vitality" i "MOUZ Esports" = "MOUZ", czyli
 *                    przypadki, w ktorych CUDZY serwis skraca nazwe inaczej
 *                    niz my.
 *
 * Probowalem najpierw samego zdjecia ozdobnikow i to PSUJE pierwsza grupe:
 * "Natus Vincere" przestaje byc "navi", bo zdjecie ozdobnikow omija tablice
 * scalen. Dlatego liczy sie czesc wspolna zestawow, a nie rownosc kluczy.
 *
 * DLACZEGO LUZNIEJSZE POROWNANIE JEST TU BEZPIECZNE: parowanie wymaga OBU
 * druzyn naraz i godziny w oknie. Zeby wpuscic zly mecz, musialyby w tym
 * samym oknie czasowym zagrac dwie rozne organizacje o nazwach roznicacych
 * sie wylacznie slowem "team" albo "esports". Te klucze NIE ida nigdzie poza
 * parowanie - statystyki druzyn dalej grupuje teamKey().
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

    // Skrocona nazwa tez przechodzi przez tablice scalen: "Team Natus
    // Vincere" -> "natusvincere" -> "navi".
    const scalony = teamKey(bezOzdobnikow);

    if (scalony) zestaw.add(scalony);
  }

  return zestaw;
}

/** Nazwy druzyn z rekordu dostawcy, w kilku mozliwych ksztaltach. */
function nazwyDruzyn(rekord) {
  const kandydaci = [
    rekord?.opponent1,
    rekord?.opponent2,
    ...(Array.isArray(rekord?.opponents) ? rekord.opponents : []),
    ...(Array.isArray(rekord?.match2opponents) ? rekord.match2opponents : []),
  ];

  return kandydaci
    .map((o) => {
      if (!o) return null;
      if (typeof o === "string") return o;

      return o.name || o.template || o.opponent?.name || null;
    })
    .filter(Boolean);
}

function majaCzescWspolna(a, b) {
  for (const k of a) {
    if (b.has(k)) return true;
  }

  return false;
}

/**
 * Czy ten rekord dostawcy to NASZ mecz.
 *
 * Para musi zgadzac sie na DWA sposoby naraz: obie druzyny i godzina
 * w rozsadnym oknie. Sama nazwa nie wystarcza, bo te same dwie druzyny graja
 * ze soba kilka razy w sezonie; sama godzina tym bardziej, bo o 15:00 gra
 * polowa turnieju.
 *
 * @param nasz   wiersz z `matches`: team_a, team_b, start_time_utc (UTC)
 * @param rekord rekord dostawcy
 */
export function matchesOurMatch({ nasz, rekord, oknoMinut = OKNO_MINUT } = {}) {
  if (!nasz || !rekord) return { ok: false, reason: "brak danych" };

  const nasze = [nasz.team_a, nasz.team_b].map((n) => kluczeNazwy(n));

  if (nasze.some((z) => z.size === 0)) {
    return { ok: false, reason: "nasze nazwy druzyn puste" };
  }

  const ich = nazwyDruzyn(rekord).map((n) => kluczeNazwy(n));

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

  const naszCzas = naMilisekundy(nasz.start_time_utc);
  const ichCzas = naMilisekundy(
    rekord.date || rekord.begin_at || rekord.start_time || rekord.dateexact,
  );

  // Brak godziny po ktorejkolwiek stronie: same druzyny to za malo, zeby
  // zapisac mapy do konkretnego meczu.
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
