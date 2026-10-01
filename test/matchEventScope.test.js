// Zapytanie o mecze FAZY musi podawac event_id.
//
// CO SIE STALO. Nowy turniej na serwerze, ktory mial juz jeden turniej,
// pokazywal mecze tego poprzedniego. Panel typowania gracza, lista meczow
// w adminie bota i czyszczenie fazy szukaly meczow tak:
//
//   WHERE m.guild_id = ? AND m.phase = ?
//
// Ani slowa o evencie. Dzialalo, dopoki serwer mial JEDEN turniej z meczami
// - wtedy para serwer+faza byla przypadkiem unikalna. Zmierzone na produkcji
// w chwili zgloszenia, guild 1161660208951607397, faza SWISS_STAGE1:
//
//   event_id 37 -> 33 mecze    (IEM Cologne, turniej zakonczony)
//   event_id 97 ->  0 meczow   (nowy turniej, ten o ktory chodzilo)
//
// Najgorzej wypadalo to przy czyszczeniu fazy: cztery DELETE po serwerze
// i fazie zabieraly POPRZEDNIEMU turniejowi mecze, typy, wyniki i punkty.
// Wpis w logu nazywal to "guild-safe" - i byl to prawda, tylko ze
// event-safe nie bylo.
//
// CO PILNUJE TEN TEST. Kazde zapytanie dotykajace meczow albo tabel od nich
// zaleznych, ktore filtruje po FAZIE, musi tez podac event_id. Faza jest
// jedynym sensownym wyzwalaczem: to ona powtarza sie miedzy turniejami tego
// samego serwera ("SWISS_STAGE1" istnieje w kazdym), wiec zapytanie, ktore
// nia filtruje, zawsze ma na mysli jeden konkretny turniej.
//
// CZEGO NIE PILNUJE. Zapytan po samym id meczu (id jest globalnie unikalne)
// ani swiadomie ogolnoserwerowych, jak liczenie meczow druzyny przed jej
// skasowaniem albo wyczyszczenie serwera przez endTournament. Te nie
// filtruja po fazie i tutaj nie wpadaja.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const KORZEN = path.join(__dirname, "..");

/** Katalogi z kodem, ktory sam pisze SQL. node_modules nas nie dotyczy. */
const KATALOGI = [
  "handlers",
  "commands",
  "utils",
  "events",
  path.join("server", "routes"),
  path.join("server", "lib"),
];

const TABELE_MECZOWE = [
  "matches",
  "match_predictions",
  "match_results",
  "match_points",
  "match_map_predictions",
  "match_map_results",
];

function plikiJs(katalog) {
  const pelny = path.join(KORZEN, katalog);

  if (!fs.existsSync(pelny)) return [];

  const wynik = [];

  for (const wpis of fs.readdirSync(pelny, { withFileTypes: true })) {
    if (wpis.name === "node_modules") continue;

    const sciezka = path.join(katalog, wpis.name);

    if (wpis.isDirectory()) {
      wynik.push(...plikiJs(sciezka));
    } else if (wpis.name.endsWith(".js")) {
      wynik.push(sciezka);
    }
  }

  return wynik;
}

/** Literaly w odwroconych apostrofach - tak w tym projekcie pisze sie SQL. */
function literalySql(tresc) {
  const znalezione = [];
  const wzor = /`([^`]*)`/g;

  let trafienie = wzor.exec(tresc);

  for (; trafienie !== null; trafienie = wzor.exec(tresc)) {
    znalezione.push({
      sql: trafienie[1],
      linia: tresc.slice(0, trafienie.index).split("\n").length,
    });
  }

  return znalezione;
}

function dotykaMeczow(plaski) {
  return TABELE_MECZOWE.some((tabela) =>
    new RegExp(`\\b${tabela}\\b`).test(plaski),
  );
}

test("zapytanie o mecze fazy zawsze podaje event_id", () => {
  const winni = [];
  let sprawdzonych = 0;

  for (const katalog of KATALOGI) {
    for (const wzgledny of plikiJs(katalog)) {
      const tresc = fs
        .readFileSync(path.join(KORZEN, wzgledny), "utf8")
        .replace(/\r\n/g, "\n");

      for (const { sql, linia } of literalySql(tresc)) {
        const plaski = sql.split(/\s+/).join(" ");

        if (!dotykaMeczow(plaski)) continue;

        // Interesuja nas tylko zapytania, ktore po fazie FILTRUJA. Samo
        // wypisanie kolumny w SELECT nie jest zadnym zalozeniem, a
        // "UPDATE matches SET phase = ?" to nie filtr, tylko zapis.
        const odWhere = plaski.search(/\bWHERE\b/i);

        if (odWhere === -1) continue;

        const warunek = plaski.slice(odWhere);

        if (!/\bphase\s*(=|IN)\s*/i.test(warunek)) continue;

        // Po samym id meczu wolno - id jest globalnie unikalne, wiec taki
        // warunek i tak trafia w jeden turniej.
        if (/\b(m\.)?id\s*=\s*\?/i.test(warunek)) continue;

        sprawdzonych += 1;

        // event_id musi stac w WARUNKU, a nie gdziekolwiek w zapytaniu.
        // Samo "mp.event_id = m.event_id" w zlaczeniu niczego nie zawezi
        // - laczy tylko typy z meczem, ktory i tak juz zostal wybrany.
        if (/\bevent_id\b/.test(warunek)) continue;

        winni.push(
          `${wzgledny.replace(/\\/g, "/")}:${linia}\n      ${plaski.slice(0, 120)}`,
        );
      }
    }
  }

  // Gdyby te zapytania kiedys przeniesiono gdzie indziej, straznik zamilklby
  // bez slowa zamiast powiedziec, ze nie ma juz czego pilnowac.
  assert.ok(
    sprawdzonych >= 5,
    `straznik przestal cokolwiek widziec - zapytan po fazie: ${sprawdzonych}`,
  );

  assert.deepEqual(
    winni,
    [],
    `zapytanie o mecze fazy bez event_id siega do INNYCH turniejow tego serwera:\n  ${winni.join(
      "\n  ",
    )}`,
  );
});

test("czyszczenie fazy zdejmuje dane JEDNEGO turnieju", () => {
  // Osobno i wprost, bo to jedyne miejsce, w ktorym pomylka jest nieodwracalna.
  const plik = path.join(
    KORZEN,
    "handlers",
    "matches",
    "clearMatchesPhaseSelect.js",
  );

  const tresc = fs.readFileSync(plik, "utf8").replace(/\r\n/g, "\n");

  const usuwajace = literalySql(tresc).filter(({ sql }) =>
    /^\s*DELETE\b/i.test(sql),
  );

  assert.equal(
    usuwajace.length,
    4,
    "czyszczenie fazy ma kasowac punkty, typy, wyniki i mecze - cztery DELETE",
  );

  for (const { sql, linia } of usuwajace) {
    assert.ok(
      sql.includes("event_id"),
      `DELETE w linii ${linia} nie ogranicza sie do jednego turnieju`,
    );
  }

  // I bierze event z jedynego zrodla prawdy o aktywnym turnieju.
  assert.ok(
    tresc.includes("getActiveEventId"),
    "czyszczenie fazy nie rozstrzyga juz, o ktory turniej chodzi",
  );
});
