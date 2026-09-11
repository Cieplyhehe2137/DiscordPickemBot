// Backup pojedynczej gildii.
//
// Ta funkcja ma za soba dwa bledy i oba byly wyciekiem danych miedzy gildiami.
// Oba ciche: zrzut powstawal normalnie, tylko zawieral za duzo. Zadnego z nich
// nie wykrylo by sprawdzenie "czy backup sie udal" - roznica siedziala
// wylacznie w ksztalcie opcji przekazanych do mysqldump.
//
// Dlatego testy patrza dokladnie na te opcje, a nie na wynik.

const test = require("node:test");
const assert = require("node:assert/strict");

const GUILD_BACKUP = "../server/lib/guildBackup.js";

const CFG = {
  DB_HOST: "db",
  DB_PORT: "3306",
  DB_USER: "u",
  DB_PASS: "p",
  DB_NAME: "pickem",
};

// Tabele w bazie: te z guild_id i te bez.
const KOLUMNY = [
  { TABLE_NAME: "events", COLUMN_NAME: "id" },
  { TABLE_NAME: "events", COLUMN_NAME: "guild_id" },
  { TABLE_NAME: "match_predictions", COLUMN_NAME: "guild_id" },
  { TABLE_NAME: "sessions", COLUMN_NAME: "session_id" },
  { TABLE_NAME: "admin_users", COLUMN_NAME: "user_id" },
];

async function narzedzia({ kolumny = KOLUMNY, cfg = CFG } = {}) {
  const { createGuildBackupTools } = await import(GUILD_BACKUP);

  const wywolaniaDump = [];
  let polaczenieZamkniete = false;

  const instancja = createGuildBackupTools({
    mysql2: {
      async createConnection() {
        return {
          async query() {
            return [kolumny];
          },
          async end() {
            polaczenieZamkniete = true;
          },
        };
      },
    },
    mysqldump: async (opcje) => {
      wywolaniaDump.push(opcje);
    },
    guildRegistry: {
      getGuildConfig: () => cfg,
      ensureGuildDirs: () => {},
      getGuildPaths: () => ({ backupDir: "/backupy" }),
    },
    path: { join: (...cz) => cz.join("/") },
    sqlEscape: (v) => String(v).replace(/'/g, "\\'"),
    pruneGuildBackups: () => ["stary.sql"],
  });

  return {
    ...instancja,
    wywolaniaDump,
    czyZamkniete: () => polaczenieZamkniete,
  };
}

test("zrzucane sa wylacznie tabele majace kolumne guild_id", async () => {
  const { createGuildBackup, wywolaniaDump } = await narzedzia();

  const wynik = await createGuildBackup("111");
  const [opcje] = wywolaniaDump;

  // sessions i admin_users sa globalne - filtr po guild_id z definicji ich nie
  // obejmuje, wiec wpadlyby do pliku W CALOSCI. To wlasnie tak admin jednej
  // gildii pobieral sesje logowania wszystkich.
  assert.deepEqual(opcje.dump.tables.sort(), ["events", "match_predictions"]);
  assert.ok(!opcje.dump.tables.includes("sessions"));
  assert.ok(!opcje.dump.tables.includes("admin_users"));

  assert.equal(wynik.tablesCount, 2);
  assert.equal(wynik.skippedTablesCount, 2);
});

test("filtr siedzi pod dump.data.where, bo tylko tam jest czytany", async () => {
  const { createGuildBackup, wywolaniaDump } = await narzedzia();

  await createGuildBackup("111");
  const [opcje] = wywolaniaDump;

  // mysqldump po cichu ignoruje nieznane pola. Gdy `where` lezalo jako
  // dump.where, filtr nie dzialal wcale i backup zawieral CALA baze - bez
  // zadnego bledu po drodze.
  assert.ok(opcje.dump.data, "dump.data musi istniec");
  assert.ok(opcje.dump.data.where, "filtr musi byc w dump.data.where");
  assert.equal(opcje.dump.where, undefined, "nie wolno go zostawic wyzej");
});

test("kazda zrzucana tabela dostaje warunek na wlasciwa gildie", async () => {
  const { createGuildBackup, wywolaniaDump } = await narzedzia();

  await createGuildBackup("111");
  const { where } = wywolaniaDump[0].dump.data;

  assert.deepEqual(Object.keys(where).sort(), ["events", "match_predictions"]);

  for (const [tabela, warunek] of Object.entries(where)) {
    assert.equal(warunek, "guild_id = '111'", tabela);
  }
});

test("guild_id jest ekranowany, zanim trafi do warunku", async () => {
  const { createGuildBackup, wywolaniaDump } = await narzedzia();

  await createGuildBackup("111' OR '1'='1");
  const { where } = wywolaniaDump[0].dump.data;

  // Warunek sklada sie z tekstu, wiec apostrof musi byc ekranowany - inaczej
  // filtr dalo by sie rozszerzyc na cala tabele.
  assert.equal(where.events, "guild_id = '111\\' OR \\'1\\'=\\'1'");
});

test("brak konfiguracji gildii przerywa, zamiast zrzucac cokolwiek", async () => {
  const { createGuildBackup, wywolaniaDump } = await narzedzia({ cfg: null });

  await assert.rejects(
    () => createGuildBackup("999"),
    /Missing DB config/,
  );

  assert.equal(wywolaniaDump.length, 0, "nic nie zostalo zrzucone");
});

test("polaczenie do odczytu schematu jest zamykane", async () => {
  const { createGuildBackup, czyZamkniete } = await narzedzia();

  await createGuildBackup("111");

  assert.equal(czyZamkniete(), true);
});

test("nazwa pliku niesie gildie i znacznik czasu bez dwukropkow", async () => {
  const { createGuildBackup } = await narzedzia();

  const wynik = await createGuildBackup("111");

  // Dwukropki i kropki z ISO nie moga trafic do nazwy pliku na Windowsie,
  // a nazwa musi pasowac do wzorca sprawdzanego przy pobieraniu.
  assert.match(wynik.fileName, /^backup_111_[\d-]+T[\d-]+Z\.sql$/);
  assert.ok(!wynik.fileName.includes(":"));
});

test("po zrzucie odpalane jest sprzatanie starych kopii", async () => {
  const { createGuildBackup } = await narzedzia();

  const wynik = await createGuildBackup("111");

  assert.deepEqual(wynik.prunedFiles, ["stary.sql"]);
});
