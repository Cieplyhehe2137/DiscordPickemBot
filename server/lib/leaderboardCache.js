// Pamięć podręczna policzonego rankingu.
//
// Po co, skoro ranking i tak schodzi już poniżej sekundy: bo ten czas płaci
// KAŻDY wchodzący osobno. Trasa robi jedną falę zapytań, a fala kosztuje
// podróż do bazy stojącej na innej maszynie - zmierzone na serwerze 177 ms
// plus praca zapytań, razem około 0,9 s.
//
// Kiedy to naprawdę ma znaczenie: NIE dziś. Serwis ma dziś siedem wejść na
// dobę i przy takim ruchu ta pamięć prawie nigdy nie trafi - drugie żądanie
// o ten sam ranking po prostu nie przychodzi w ciągu trzydziestu sekund.
// Ma znaczenie w dniu turnieju, gdy pięciuset typujących odświeża ranking
// po przeliczeniu punktów. Wtedy jedno przeliczenie zamiast pięciuset jest
// różnicą między stroną, która odpowiada, a stroną, która stoi.
//
// Dlatego ważniejsze od samego zapamiętywania jest SCALANIE ŻĄDAŃ: gdy
// ranking dopiero się liczy, a przychodzi drugie żądanie o ten sam turniej,
// czeka ono na tę samą pracę zamiast zaczynać własną. To jest jedyna rzecz,
// która chroni w chwili, gdy ochrona jest potrzebna.
//
// CZEMU CZAS ŻYCIA, A NIE UNIEWAŻNIANIE PRZY ZMIANIE PUNKTÓW: punkty
// przelicza także BOT, a to osobny proces na osobnej maszynie. Ten proces
// nie ma jak powiedzieć API, że ranking się zmienił. Unieważnianie
// z wnętrza API łapałoby więc tylko połowę przypadków - przeliczenia
// klikane w panelu na stronie - a drugą połowę i tak musiałby obsłużyć
// czas życia. Skoro czas życia jest potrzebny zawsze, jest tu jedynym
// mechanizmem; `uniewaznij` czeka gotowe, gdyby kiedyś przydało się skrócić
// oczekiwanie administratorowi, ale nikt go dziś nie woła.
//
// Trzydzieści sekund to tyle, ile wolno pokazywać nieaktualny ranking po
// przeliczeniu punktów. Strona i tak odświeża się sama przez socket, więc
// gracz zobaczy zmianę przy najbliższym odświeżeniu.

const CZAS_ZYCIA_MS = 30_000;

export function createLeaderboardCache({
  load,
  ttlMs = CZAS_ZYCIA_MS,
  teraz = () => Date.now(),
  maxEntries = 8,
} = {}) {
  if (typeof load !== "function") {
    throw new Error("createLeaderboardCache: wymagana funkcja load");
  }

  const gotowe = new Map();
  const wTrakcie = new Map();

  function swiezy(wpis) {
    return wpis && teraz() - wpis.kiedy < ttlMs;
  }

  async function get(klucz) {
    const wpis = gotowe.get(klucz);

    if (swiezy(wpis)) return wpis.dane;

    // Przeterminowany wpis znika od razu, nie dopiero po udanym przeliczeniu.
    // Inaczej awaria bazy podawałaby dalej stary ranking bez końca.
    if (wpis) gotowe.delete(klucz);

    const juzLeci = wTrakcie.get(klucz);

    if (juzLeci) return juzLeci;

    const praca = (async () => {
      const dane = await load(klucz);

      gotowe.set(klucz, { dane, kiedy: teraz() });

      // Map zachowuje kolejność wstawiania, więc pierwszy klucz to najdawniej
      // dodany. Turniejów są jednostki, ale ranking to kilkaset wierszy
      // i nie ma powodu trzymać wszystkich, o jakie kiedykolwiek zapytano.
      while (gotowe.size > maxEntries) {
        gotowe.delete(gotowe.keys().next().value);
      }

      return dane;
    })();

    wTrakcie.set(klucz, praca);

    try {
      return await praca;
    } finally {
      // Zdejmowane także po błędzie - inaczej jedna nieudana próba
      // zapamiętywałaby odrzuconą obietnicę i każde kolejne żądanie
      // dostawałoby ten sam błąd bez ponowienia.
      wTrakcie.delete(klucz);
    }
  }

  return {
    get,

    // Wołane po przeliczeniu punktów Z POZIOMU API. Nie zastępuje czasu
    // życia - patrz nagłówek.
    uniewaznij: (klucz) => {
      gotowe.delete(klucz);
    },

    rozmiar: () => gotowe.size,

    wyczysc: () => {
      gotowe.clear();
      wTrakcie.clear();
    },
  };
}
