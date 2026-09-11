// Lista backupow i sprzatanie starych.
//
// Sprzatanie KASUJE pliki, wiec regula "ile zostaje i ktore" jest warta testu.
// Najgrozniejszy mozliwy blad to odwrocone sortowanie: kod usuwa ogon listy, a
// lista ma isc od najnowszego - zamiana kolejnosci skasowalaby wiec najnowsze
// kopie i zostawila same przeterminowane, nie zmieniajac ani jednej liczby.
//
// Testy uzywaja prawdziwego fs na katalogu tymczasowym, a nie atrapy: chodzi
// tu wlasnie o zachowanie na plikach, wiec atrapa sprawdzalaby sama siebie.

const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BACKUP_FILES = "../server/lib/backupFiles.js";

// Tworzy katalog z plikami o narzuconych czasach modyfikacji.
// pliki: [[nazwa, minutTemu], ...]
function przygotuj(pliki) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backups-"));

  for (const [nazwa, minutTemu] of pliki) {
    const pelna = path.join(dir, nazwa);
    fs.writeFileSync(pelna, "-- dump\n");

    const kiedy = new Date(Date.now() - minutTemu * 60 * 1000);
    fs.utimesSync(pelna, kiedy, kiedy);
  }

  return dir;
}

async function narzedzia(dir, retention = 10) {
  const { createBackupFiles } = await import(BACKUP_FILES);

  const ostrzezenia = [];

  const instancja = createBackupFiles({
    fs,
    path,
    guildRegistry: {
      ensureGuildDirs: () => {},
      getGuildPaths: () => ({ backupDir: dir }),
    },
    retention,
    logWarn: (...args) => ostrzezenia.push(args),
  });

  return { ...instancja, ostrzezenia };
}

function nazwa(i) {
  return `backup_test_2026-09-11T00-00-${String(i).padStart(2, "0")}Z.sql`;
}

test("lista idzie od najnowszego", async () => {
  const dir = przygotuj([
    [nazwa(1), 30],
    [nazwa(2), 10],
    [nazwa(3), 20],
  ]);

  const { listGuildBackups } = await narzedzia(dir);

  assert.deepEqual(
    listGuildBackups("1").map((b) => b.fileName),
    [nazwa(2), nazwa(3), nazwa(1)],
  );
});

test("lista pomija pliki, ktore nie sa zrzutami", async () => {
  const dir = przygotuj([
    [nazwa(1), 10],
    ["notatka.txt", 5],
    ["archiwum.zip", 1],
  ]);

  const { listGuildBackups } = await narzedzia(dir);

  assert.deepEqual(
    listGuildBackups("1").map((b) => b.fileName),
    [nazwa(1)],
  );
});

test("lista podaje rozmiar i daty", async () => {
  const dir = przygotuj([[nazwa(1), 5]]);

  const { listGuildBackups } = await narzedzia(dir);
  const [wpis] = listGuildBackups("1");

  assert.equal(wpis.sizeBytes, "-- dump\n".length);
  assert.ok(!Number.isNaN(Date.parse(wpis.modifiedAt)), "modifiedAt to data");
  assert.ok(!Number.isNaN(Date.parse(wpis.createdAt)), "createdAt to data");
});

test("sprzatanie zostawia dokladnie tyle, ile wynosi limit", async () => {
  // 15 kopii, kazda starsza od poprzedniej.
  const dir = przygotuj(
    Array.from({ length: 15 }, (_, i) => [nazwa(i), i * 10]),
  );

  const { listGuildBackups, pruneGuildBackups } = await narzedzia(dir, 10);

  const usuniete = pruneGuildBackups("1");

  assert.equal(usuniete.length, 5);
  assert.equal(listGuildBackups("1").length, 10);
});

test("sprzatanie usuwa NAJSTARSZE, a nie najnowsze", async () => {
  const dir = przygotuj(
    Array.from({ length: 15 }, (_, i) => [nazwa(i), i * 10]),
  );

  const { listGuildBackups, pruneGuildBackups } = await narzedzia(dir, 10);

  const usuniete = pruneGuildBackups("1");
  const zostaly = listGuildBackups("1").map((b) => b.fileName);

  // nazwa(0) jest najnowsza (0 minut temu), nazwa(14) najstarsza.
  for (const i of [10, 11, 12, 13, 14]) {
    assert.ok(usuniete.includes(nazwa(i)), `${nazwa(i)} powinna zniknac`);
  }

  assert.ok(zostaly.includes(nazwa(0)), "najnowsza kopia musi zostac");
  assert.ok(!zostaly.includes(nazwa(14)), "najstarsza nie moze zostac");
});

test("ponizej limitu nie kasuje niczego", async () => {
  const dir = przygotuj(Array.from({ length: 3 }, (_, i) => [nazwa(i), i * 10]));

  const { listGuildBackups, pruneGuildBackups } = await narzedzia(dir, 10);

  assert.deepEqual(pruneGuildBackups("1"), []);
  assert.equal(listGuildBackups("1").length, 3);
});

test("nieudane kasowanie nie przerywa sprzatania reszty", async () => {
  const dir = przygotuj(
    Array.from({ length: 13 }, (_, i) => [nazwa(i), i * 10]),
  );

  const { createBackupFiles } = await import(BACKUP_FILES);

  const ostrzezenia = [];
  let pierwsze = true;

  const { pruneGuildBackups } = createBackupFiles({
    // fs, w ktorym pierwsze usuniecie zawodzi.
    fs: {
      ...fs,
      unlinkSync(p) {
        if (pierwsze) {
          pierwsze = false;
          throw new Error("plik zajety");
        }
        return fs.unlinkSync(p);
      },
    },
    path,
    guildRegistry: {
      ensureGuildDirs: () => {},
      getGuildPaths: () => ({ backupDir: dir }),
    },
    retention: 10,
    logWarn: (...args) => ostrzezenia.push(args),
  });

  const usuniete = pruneGuildBackups("1");

  // Nieudane sprzatanie nie moze wywrocic samego backupu - plik juz powstal
  // i jest wazniejszy niz limit.
  assert.equal(usuniete.length, 2, "pozostale dwie usuniete mimo bledu");
  assert.equal(ostrzezenia.length, 1, "problem zapisany w logu");
});
