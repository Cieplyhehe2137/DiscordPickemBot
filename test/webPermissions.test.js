// Uprawnienia administratora po stronie frontu.
//
// To jest wylacznie warstwa prezentacji - o tym, czy akcja przejdzie, decyduje
// requireGuildAdmin na serwerze. Ale rozjazd miedzy tymi dwiema kopiami reguly
// jest widoczny natychmiast i w obie strony: albo panel pokazuje przyciski
// komus, kto zaraz dostanie 403, albo ukrywa je przed prawdziwym adminem.
//
// Dlatego oprocz wlasnych przypadkow ostatni test porownuje obie kopie wprost.
// Zadna nie importuje niczego, wiec dziala to bez instalowania zaleznosci.

const test = require("node:test");
const assert = require("node:assert/strict");

const WEB = "../web/src/lib/permissions.js";
const SERWER = "../server/lib/permissions.js";

const ADMIN = "8";
const BRAK_ADMINA = "104324673";

function user(guilds) {
  return { id: "1", guilds };
}

test("admin gdziekolwiek decyduje o wejsciu do panelu w nawigacji", async () => {
  const { isAdminAnywhere } = await import(WEB);

  assert.equal(
    isAdminAnywhere(user([{ id: "111", permissions: BRAK_ADMINA }])),
    false,
  );
  assert.equal(
    isAdminAnywhere(
      user([
        { id: "111", permissions: BRAK_ADMINA },
        { id: "222", permissions: ADMIN },
      ]),
    ),
    true,
    "wystarczy jeden serwer",
  );
});

test("brak uzytkownika albo listy serwerow nie wysypuje widoku", async () => {
  const { isAdminAnywhere, adminGuildIds, isAdminOfGuild } = await import(WEB);

  for (const pusty of [null, undefined, {}, user(undefined)]) {
    assert.equal(isAdminAnywhere(pusty), false);
    assert.deepEqual([...adminGuildIds(pusty)], []);
    assert.equal(isAdminOfGuild(pusty, "111"), false);
  }
});

test("zbior serwerow administrowanych zawiera tylko te z bitem ADMINISTRATOR", async () => {
  const { adminGuildIds } = await import(WEB);

  const zbior = adminGuildIds(
    user([
      { id: "111", permissions: ADMIN },
      { id: "222", permissions: BRAK_ADMINA },
      { id: "333", permissions: ADMIN },
    ]),
  );

  assert.deepEqual([...zbior].sort(), ["111", "333"]);
});

test("uprawnienia jednego serwera nie przenosza sie na inny", async () => {
  const { isAdminOfGuild } = await import(WEB);

  const u = user([{ id: "111", permissions: ADMIN }]);

  assert.equal(isAdminOfGuild(u, "111"), true);
  assert.equal(isAdminOfGuild(u, "222"), false);
  assert.equal(isAdminOfGuild(u, null), false, "brak serwera to nie admin");
});

test("id serwera porownuje sie jako tekst", async () => {
  const { isAdminOfGuild } = await import(WEB);

  // Discord podaje id jako tekst, ale w propsach potrafi trafic sie liczba.
  const u = user([{ id: "111", permissions: ADMIN }]);

  assert.equal(isAdminOfGuild(u, 111), true);
});

test("szerokie pole bitowe i smieci zachowuja sie jak na serwerze", async () => {
  const { isAdminOfGuild } = await import(WEB);

  const szerokie = (8n | (1n << 40n)).toString();
  assert.equal(
    isAdminOfGuild(user([{ id: "111", permissions: szerokie }]), "111"),
    true,
    "Number zgubilby starsze bity",
  );

  assert.equal(
    isAdminOfGuild(user([{ id: "111", permissions: "nie liczba" }]), "111"),
    false,
    "BigInt by rzucil - ma wyjsc odmowa",
  );
});

test("front i serwer odpowiadaja tak samo na tych samych danych", async () => {
  const { isAdminOfGuild } = await import(WEB);
  const { hasAdminPermission } = await import(SERWER);

  const przypadki = [
    "8",
    "0",
    "104324673",
    (8n | (1n << 40n)).toString(),
    (1n << 40n).toString(),
    "9",
    "2147483648",
    "nie liczba",
    "",
  ];

  const rozjazdy = [];

  for (const permissions of przypadki) {
    const u = user([{ id: "111", permissions }]);

    const front = isAdminOfGuild(u, "111");
    const serwer = hasAdminPermission(u, "111");

    if (front !== serwer) {
      rozjazdy.push(`${permissions}: front=${front} serwer=${serwer}`);
    }
  }

  // Brak uzytkownika i obca gildia tez musza sie zgadzac.
  const brak = [
    [null, "111"],
    [user([]), "111"],
    [user([{ id: "222", permissions: "8" }]), "111"],
  ];

  for (const [u, gid] of brak) {
    if (isAdminOfGuild(u, gid) !== hasAdminPermission(u, gid)) {
      rozjazdy.push(`${JSON.stringify(u)} / ${gid}`);
    }
  }

  assert.deepEqual(rozjazdy, [], "reguła rozjechala sie miedzy kopiami");
});
