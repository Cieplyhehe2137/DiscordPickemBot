// Zaznaczanie wielu pozycji na liscie (web/src/lib/selection.js).
//
// Wyciagniete z panelu MVP wlasnie po to, zeby dalo sie to przetestowac:
// w pliku .jsx nie ma jak, a zachowanie ma przypadki brzegowe, ktore latwo
// zrobic odwrotnie - i ktorych nikt nie zauwazy, dopoki nie skasuje czegos
// nie tego, co chcial.
//
// Modul nie importuje niczego, wiec dziala bez instalowania zaleznosci.

const test = require("node:test");
const assert = require("node:assert/strict");

const SELECTION = "../web/src/lib/selection.js";

test("pojedyncze zaznaczenie przelacza w obie strony", async () => {
  const { toggleSelected } = await import(SELECTION);

  const puste = new Set();
  const zJednym = toggleSelected(puste, 1);

  assert.deepEqual([...zJednym], [1]);
  assert.deepEqual([...toggleSelected(zJednym, 1)], []);
});

test("zwraca NOWY zbior, nie zmienia podanego", async () => {
  const { toggleSelected, toggleGroup } = await import(SELECTION);

  // React porownuje stan po tozsamosci: mutacja w miejscu nie wywolalaby
  // ponownego renderu i zaznaczenie nie pojawiloby sie na ekranie.
  const wyjsciowy = new Set([1]);

  const poPrzelaczeniu = toggleSelected(wyjsciowy, 2);
  assert.notEqual(poPrzelaczeniu, wyjsciowy);
  assert.deepEqual([...wyjsciowy], [1], "wejscie ma zostac nietkniete");

  const poGrupie = toggleGroup(wyjsciowy, [5, 6]);
  assert.notEqual(poGrupie, wyjsciowy);
  assert.deepEqual([...wyjsciowy], [1]);
});

test("pusta grupa nie jest zaznaczona", async () => {
  const { isGroupSelected } = await import(SELECTION);

  // Inaczej naglowek grupy bez pozycji pokazywalby zaznaczony checkbox,
  // a kliniecie go nie robiloby nic.
  assert.equal(isGroupSelected(new Set(), []), false);
  assert.equal(isGroupSelected(new Set([1, 2]), []), false);
});

test("grupa zaznaczona dopiero, gdy wszystkie jej pozycje sa w zbiorze", async () => {
  const { isGroupSelected } = await import(SELECTION);

  assert.equal(isGroupSelected(new Set([1, 2]), [1, 2]), true);
  assert.equal(isGroupSelected(new Set([1]), [1, 2]), false);
  assert.equal(isGroupSelected(new Set([1, 2, 9]), [1, 2]), true, "nadmiar nie przeszkadza");
});

test("grupa zaznaczona czesciowo DOZNACZA sie, a nie odznacza", async () => {
  const { toggleGroup } = await import(SELECTION);

  // To jest ten przypadek, ktory latwo zrobic odwrotnie: klikniecie
  // "zaznacz wszystkie" przy trzech z dziesieciu znaczy "chce wszystkie",
  // a nie "odznacz te trzy".
  const wynik = toggleGroup(new Set([1]), [1, 2, 3]);

  assert.deepEqual([...wynik].sort(), [1, 2, 3]);
});

test("grupa zaznaczona w calosci odznacza sie", async () => {
  const { toggleGroup } = await import(SELECTION);

  const wynik = toggleGroup(new Set([1, 2, 3]), [1, 2, 3]);

  assert.deepEqual([...wynik], []);
});

test("odznaczanie grupy nie rusza pozycji spoza niej", async () => {
  const { toggleGroup } = await import(SELECTION);

  // Dwie grupy w panelu MVP: "na liscie" i "poza lista". Odznaczenie jednej
  // nie moze zdjac zaznaczenia z drugiej.
  const wynik = toggleGroup(new Set([1, 2, 7, 8]), [1, 2]);

  assert.deepEqual([...wynik].sort(), [7, 8]);
});

test("zaznaczenie grupy dokłada sie do istniejacego", async () => {
  const { toggleGroup } = await import(SELECTION);

  const wynik = toggleGroup(new Set([7]), [1, 2]);

  assert.deepEqual([...wynik].sort(), [1, 2, 7]);
});
