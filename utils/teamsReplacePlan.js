// utils/teamsReplacePlan.js
//
// Jak doprowadzić słownik drużyn serwera do podanej listy nazw, NIE kasując
// go i nie odtwarzając od zera.
//
// PO CO. `replaceTeams` robiło `DELETE FROM teams WHERE guild_id = ?`, a potem
// wstawiało listę od nowa - czyli każda drużyna dostawała NOWE id. Dopóki do
// `teams` nic się nie odwoływało, było to niegroźne: mecze, typy i wyniki
// trzymają nazwy drużyn jako tekst. Migracja 0014 to zmieniła. `event_teams`
// wskazuje drużynę przez `team_id` i ma `ON DELETE CASCADE`, więc taki import
// zabierał po cichu rostery WSZYSTKICH turniejów tego serwera - bez
// ostrzeżenia, bez licznika, bez śladu w logu.
//
// Przy okazji ginęło wszystko, czego import nie dostaje w swojej liście:
// `external_name` (ręcznie wpisany alias, po którym utils/matchProposals.js
// dopasowuje nazwy dostawcy wyników), `short_name` i `logo_url`.
//
// ZASADA, KTÓRA Z TEGO WYNIKA: import ustawia to, co dostał - nazwy, ich
// kolejność i `active = 1` - i nie wyrzuca tego, czego nie dostał. Drużyna,
// która zniknęła z listy, traci wszystko, bo przestaje istnieć w słowniku;
// drużyna, która na liście została, zachowuje swoje id, a więc i swoje
// miejsce w rosterach turniejów.
//
// DOPASOWANIE NAJPIERW PO DOKŁADNEJ NAZWIE, POTEM PO `teamKey` - i ta
// kolejność jest tu treścią, nie upiększeniem. Z niej wynika, że ZMIANY NAZW
// NIE MOGĄ SIĘ ZDERZYĆ z kluczem `uniq_guild_name (guild_id, name)`:
//
//   Zmiana nazwy bierze się tylko z drugiego przebiegu. Gdyby jej celem była
//   nazwa, którą trzyma inny ZACHOWANY wiersz, to pierwszy przebieg przypisał
//   by tę nazwę właśnie tamtemu wierszowi (dopasowanie dokładne), czyli do
//   drugiego przebiegu by nie doszła. A jeśli nazwę trzyma wiersz USUWANY,
//   to kasowanie idzie przed zmianami nazw i zwalnia ją.
//
// Dopasowanie po `teamKey` jest potrzebne, bo słownik re-importuje się
// z nazw z MECZÓW, a te są zapisane inaczej: mecze mają "BetBoom" przy
// słownikowym "BETBOOM" i "NAVI" przy "Natus Vincere". Bez tego taki import
// wyglądałby jak usunięcie jednej drużyny i dodanie innej - czyli roster
// znów by zniknął.
//
// Funkcja jest czysta i dostaje `klucz` argumentem, bo `teamKey` żyje
// w module ESM (server/lib/teamLogos.js), a ten plik jest CommonJS. Dzięki
// temu całą decyzję da się sprawdzić testami bez bazy i bez mostka ESM.

/**
 * @param {object} opcje
 * @param {Array<{id:number|string, name:string}>} opcje.stare
 *   Wiersze słownika W KOLEJNOŚCI SŁOWNIKA (sort_order, potem nazwa).
 * @param {string[]} opcje.nowe
 *   Nazwy z importu, bez powtórzeń, w kolejności docelowej. Pozycja na tej
 *   liście staje się `sort_order`.
 * @param {(name: string) => string} opcje.klucz
 *   Zwykle `teamKey` z server/lib/teamLogos.js.
 */
function planTeamsReplace({ stare, nowe, klucz }) {
  const wiersze = (stare || [])
    .filter((w) => w && w.name)
    .map((w) => ({ id: Number(w.id), name: String(w.name) }));

  const nazwy = (nowe || []).filter(Boolean).map(String);

  const zajete = new Set();
  const przypisane = new Map();

  // Pierwszy przebieg: dokładna nazwa. `uniq_guild_name` nie dopuszcza dwóch
  // wierszy o tej samej nazwie, więc ten indeks nie traci niczego.
  const poNazwie = new Map();

  for (const w of wiersze) {
    if (!poNazwie.has(w.name)) poNazwie.set(w.name, w);
  }

  nazwy.forEach((nazwa, i) => {
    const w = poNazwie.get(nazwa);

    if (w && !zajete.has(w.id)) {
      zajete.add(w.id);
      przypisane.set(i, w);
    }
  });

  // Drugi przebieg: ta sama drużyna zapisana inaczej. Wiersz może zostać
  // przypisany RAZ - inaczej dwie nazwy z jednej organizacji ("NAVI"
  // i "Natus Vincere" na jednej liście) celowałyby w ten sam wiersz.
  nazwy.forEach((nazwa, i) => {
    if (przypisane.has(i)) return;

    const k = klucz(nazwa);

    // Nazwa bez liter i cyfr nie ma klucza - nie ma czego dopasowywać.
    if (!k) return;

    const w = wiersze.find((x) => !zajete.has(x.id) && klucz(x.name) === k);

    if (w) {
      zajete.add(w.id);
      przypisane.set(i, w);
    }
  });

  const zostaja = [];
  const doWstawienia = [];

  nazwy.forEach((nazwa, i) => {
    const w = przypisane.get(i);
    const sortOrder = i + 1;

    if (w) {
      zostaja.push({
        id: w.id,
        oldName: w.name,
        name: nazwa,
        sortOrder,
        rename: w.name !== nazwa,
      });

      return;
    }

    doWstawienia.push({ name: nazwa, sortOrder });
  });

  const doUsuniecia = wiersze.filter((w) => !zajete.has(w.id));

  return { zostaja, doWstawienia, doUsuniecia };
}

module.exports = { planTeamsReplace };
