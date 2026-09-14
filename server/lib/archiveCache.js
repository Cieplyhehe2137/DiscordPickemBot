// Pamięć podręczna wygenerowanych archiwów .xlsx.
//
// Powód jest mierzalny: jedno archiwum IEM Cologne to 21 zapytań do bazy,
// ~6 sekund pracy i 1016 kB pliku. Endpoint jest publiczny i nie wymaga
// logowania, więc bez tego dziesięć kliknięć w ten sam przycisk to dziesięć
// niezależnych sześciosekundowych przebiegów na jednym procesie API.
//
// Trzymanie gotowego pliku jest tu bezpieczne, bo archiwum wydajemy WYŁĄCZNIE
// dla turniejów zarchiwizowanych - ich dane z definicji już się nie zmienią.
//
// Druga rzecz, ważniejsza od samego zapamiętywania: scalanie równoległych
// żądań. Gdy plik dopiero powstaje, a przychodzi drugie żądanie o ten sam
// turniej, czeka ono na tę samą pracę zamiast zaczynać własną. Bez tego
// pamięć podręczna nie chroni przed niczym w jedynym momencie, w którym
// ochrona jest potrzebna - czyli zaraz po ogłoszeniu linku.

export function createArchiveCache({ generate, maxEntries = 8 } = {}) {
  if (typeof generate !== "function") {
    throw new Error("createArchiveCache: wymagana funkcja generate");
  }

  const gotowe = new Map();
  const wTrakcie = new Map();

  async function get(klucz) {
    const zPamieci = gotowe.get(klucz);

    if (zPamieci) return zPamieci;

    const juzLeci = wTrakcie.get(klucz);

    if (juzLeci) return juzLeci;

    const praca = (async () => {
      const bufor = await generate(klucz);

      gotowe.set(klucz, bufor);

      // Map zachowuje kolejność wstawiania, więc pierwszy klucz to najdawniej
      // dodany. Turniejów są jednostki, ale plik ma megabajt i nie ma powodu
      // trzymać w pamięci procesu wszystkich, jakie kiedykolwiek pobrano.
      while (gotowe.size > maxEntries) {
        gotowe.delete(gotowe.keys().next().value);
      }

      return bufor;
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
    rozmiar: () => gotowe.size,
    wyczysc: () => {
      gotowe.clear();
      wTrakcie.clear();
    },
  };
}
