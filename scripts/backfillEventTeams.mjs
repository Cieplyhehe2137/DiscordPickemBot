#!/usr/bin/env node
//
// Dopisuje roster turniejom, które już się odbyły.
//
// PO CO. `event_teams` przyjmuje zapisy dopiero od etapu 4, więc żaden
// turniej sprzed tej zmiany nie ma własnego rostera i każdy działa na zapasie
// - dzisiejszym rosterze serwera (`teams.active = 1`). Zapas należy do
// serwera, nie do turnieju: zakończony IEM Cologne Major 2026 dostaje
// szesnaście dziś aktywnych drużyn, a zagrało w nim trzydzieści dwie.
// Prawdziwa lista uczestników leży w jego meczach.
//
// Decyzję "czy wolno i jaki roster" podejmuje server/lib/eventRosterBackfill.js
// - tam są wszystkie reguły i tam są testy. Ten plik tylko czyta bazę,
// pokazuje raport i (na żądanie) zapisuje.
//
// Domyślnie NIC nie zapisuje:
//
//   node scripts/backfillEventTeams.mjs                     # podgląd
//   node scripts/backfillEventTeams.mjs --apply              # zapis
//   node scripts/backfillEventTeams.mjs --event epl-season24 # jeden turniej
//   node scripts/backfillEventTeams.mjs --allow-incomplete   # patrz niżej
//
// --allow-incomplete DOPUSZCZA ROSTER NIEPEŁNY. Domyślnie turniej, w którym
// choć jedna nazwa z meczów nie ma wiersza w słowniku drużyn, jest POMIJANY:
// powiązanie idzie po `team_id`, więc takiej drużyny nie da się wpisać,
// a osiemnaście z trzydziestu dwóch drużyn zapisane jako "uczestnicy
// turnieju" to półprawda podana jako pewnik. Właściwa kolejność to dodać
// brakujące drużyny do słownika i puścić skrypt ponownie; ta flaga jest dla
// sytuacji, w której administrator świadomie woli listę niepełną.
//
// Skrypt NIE RUSZA turnieju, który już ma roster - wskazanie rostera w panelu
// jest decyzją człowieka. Dzięki temu wolno go puszczać wielokrotnie.
//
// PUSZCZAĆ PRZED ZAKOŃCZENIEM TURNIEJU Z CZYSZCZENIEM. Czyszczenie
// (server/routes/eventCleanup.js) usuwa `matches`, wszystkie `*_predictions`
// i wszystkie `*_results` - czyli OBA źródła, z których ten skrypt składa
// roster. Tabeli `event_teams` nie usuwa, więc roster zapisany wcześniej
// czyszczenie przeżywa i zostaje jedynym trwałym śladem tego, kto w turnieju
// zagrał. Po czyszczeniu nie ma już czego backfillować: na produkcji jest
// turniej bez ani jednego meczu (StarLadder Budapest Major 2025) i jego listy
// uczestników nie da się odtworzyć.
//
// Uruchamiać po migracji 0014_event_teams.sql i po pełnym backupie.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  planEventRoster,
  typyPozaRosterem,
  POWODY,
} from "../server/lib/eventRosterBackfill.js";

const require = createRequire(import.meta.url);

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(KATALOG, "..");

require("dotenv").config({ path: path.join(ROOT, "server", ".env") });
require("dotenv").config({ path: path.join(ROOT, ".env") });

const mysql = require("mysql2/promise");

const ZAPISZ = process.argv.includes("--apply");
const DOPUSC_NIEPELNY = process.argv.includes("--allow-incomplete");

const indeksEventu = process.argv.indexOf("--event");
const TYLKO_EVENT =
  indeksEventu !== -1 ? process.argv[indeksEventu + 1] || null : null;

// Konsola Windows chodzi tu w cp1250 i wywala skrypt w połowie na pierwszym
// znaku, którego nie zna. Nazwy drużyn i turniejów idą z bazy, więc każdy
// wypisywany napis przechodzi przez to sito.
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, ".");

const PUSTE = /^[\s\-–—_.]*$/;

/**
 * Nazwy z kolumny tekstowej.
 *
 * Te kolumny trzymają raz tablicę JSON, raz listę po przecinku, a raz samą
 * nazwę - zależnie od tego, która wersja bota je zapisała. Rozbiórka jest
 * przepisana ze scripts/fetchTeamLogos.mjs, który czyta te same kolumny.
 */
function rozbij(value) {
  if (!value) return [];

  return String(value)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter((s) => !PUSTE.test(s));
}

// Opublikowane wyniki faz. TYLKO active = 1, i to jest cała treść tego
// filtra: chodzi o to, żeby administrator mógł ponownie zapisać oficjalną
// odpowiedź, którą turniej ma TERAZ (server/routes/phaseResults.js waliduje
// ją względem rostera). Wynik zastąpiony to historia - drużyna, która
// weszła tam przez pomyłkę i nie zagrała żadnego meczu, nie ma po co
// wracać do rostera.
const ZAPYTANIA_WYNIKOW = [
  `SELECT correct_3_0 AS a, correct_0_3 AS b, correct_advancing AS c, NULL AS d
     FROM swiss_results WHERE event_id = ? AND active = 1`,
  `SELECT correct_teams AS a, NULL AS b, NULL AS c, NULL AS d
     FROM playin_results WHERE event_id = ? AND active = 1`,
  `SELECT correct_semifinalists AS a, correct_finalists AS b, correct_winner AS c,
          correct_third_place_winner AS d
     FROM playoffs_results WHERE event_id = ? AND active = 1`,
  `SELECT upper_final_a AS a, upper_final_b AS b, lower_final_a AS c,
          lower_final_b AS d
     FROM doubleelim_results WHERE event_id = ? AND active = 1`,
];

// Typy nie są źródłem rostera (patrz nagłówek eventRosterBackfill.js), ale
// czyta się je po to, żeby raport powiedział, czyj typ przestałby się
// zapisywać. Tylko active = 1, bo o ponowny zapis chodzi przy typie bieżącym.
const ZAPYTANIA_TYPOW = [
  `SELECT pick_3_0 AS a, pick_0_3 AS b, advancing AS c, NULL AS d
     FROM swiss_predictions WHERE event_id = ? AND active = 1`,
  `SELECT teams AS a, NULL AS b, NULL AS c, NULL AS d
     FROM playin_predictions WHERE event_id = ? AND active = 1`,
  `SELECT semifinalists AS a, finalists AS b, winner AS c,
          third_place_winner AS d
     FROM playoffs_predictions WHERE event_id = ? AND active = 1`,
  `SELECT upper_final_a AS a, upper_final_b AS b, lower_final_a AS c,
          lower_final_b AS d
     FROM doubleelim_predictions WHERE event_id = ? AND active = 1`,
];

async function nazwyZZapytan(pool, zapytania, eventId) {
  const nazwy = [];

  for (const sql of zapytania) {
    const [wiersze] = await pool.query(sql, [eventId]);

    for (const w of wiersze) {
      for (const kolumna of ["a", "b", "c", "d"]) {
        for (const nazwa of rozbij(w[kolumna])) {
          if (!nazwy.includes(nazwa)) nazwy.push(nazwa);
        }
      }
    }
  }

  return nazwy;
}

const OPIS_POWODU = {
  [POWODY.MA_ROSTER]: "ma juz wlasny roster - pomijam (panel jest wazniejszy)",
  [POWODY.NIE_ZAKONCZONY]:
    "turniej sie nie skonczyl - mecze sa niepelne, roster z nich zablokowalby typowanie",
  [POWODY.OTWARTE_TYPOWANIE]: "wlasnie w nim trwa typowanie - nie ruszam",
  [POWODY.BRAK_MECZOW]:
    "zero meczow - nie ma z czego zlozyc listy uczestnikow (same wyniki to lista niepelna)",
  [POWODY.NIEPELNY]: "roster bylby NIEPELNY - brakujace nazwy nizej",
};

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 3,
  });

  // Czy tabela w ogóle jest. Bez niej nie ma sensu czytać niczego dalej,
  // a komunikat musi mówić, co uruchomić - tak samo jak trasa panelu.
  try {
    await pool.query("SELECT 1 FROM event_teams LIMIT 1");
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE") {
      console.log(
        "Tabeli event_teams nie ma. Uruchom migrations/0014_event_teams.sql (po backupie).",
      );

      await pool.end();

      process.exit(1);
    }

    throw err;
  }

  const [eventy] = await pool.query(
    `SELECT id, guild_id, slug, name, status, is_archived, is_open, is_active
       FROM events
      ORDER BY guild_id ASC, id ASC`,
  );

  const wybrane = TYLKO_EVENT
    ? eventy.filter(
        (e) =>
          String(e.slug) === TYLKO_EVENT || String(e.id) === String(TYLKO_EVENT),
      )
    : eventy;

  if (TYLKO_EVENT && !wybrane.length) {
    console.log(`Nie znalazlem turnieju "${ascii(TYLKO_EVENT)}".`);

    await pool.end();

    process.exit(1);
  }

  // Słownik drużyn W KOLEJNOŚCI SŁOWNIKA - ta kolejność staje się
  // rozstawieniem turnieju, więc musi być dokładnie taka jak w panelu
  // (server/routes/eventTeams.js).
  const [slownikWiersze] = await pool.query(
    `SELECT id, guild_id, name, active
       FROM teams
      ORDER BY sort_order ASC, name ASC`,
  );

  const slownikGildii = new Map();

  for (const w of slownikWiersze) {
    if (!slownikGildii.has(w.guild_id)) slownikGildii.set(w.guild_id, []);

    slownikGildii.get(w.guild_id).push(w);
  }

  console.log(
    ZAPISZ
      ? "TRYB ZAPISU (--apply)\n"
      : "PODGLAD - nic nie zapisuje. Zapis: --apply\n",
  );

  let doZapisu = 0;
  let zapisanych = 0;
  let pominietych = 0;

  for (const ev of wybrane) {
    const slownik = slownikGildii.get(ev.guild_id) || [];

    const [[{ ile: wierszyRostera }]] = await pool.query(
      "SELECT COUNT(*) AS ile FROM event_teams WHERE event_id = ?",
      [ev.id],
    );

    const [mecze] = await pool.query(
      `SELECT team_a AS name FROM matches WHERE event_id = ? AND team_a <> ''
       UNION
       SELECT team_b AS name FROM matches WHERE event_id = ? AND team_b <> ''`,
      [ev.id, ev.id],
    );

    const nazwyZMeczow = mecze.map((m) => m.name);

    const nazwyZWynikow = await nazwyZZapytan(pool, ZAPYTANIA_WYNIKOW, ev.id);

    const plan = planEventRoster({
      event: ev,
      slownik,
      nazwyZMeczow,
      nazwyZWynikow,
      wierszyRostera: Number(wierszyRostera),
      dopuscNiepelny: DOPUSC_NIEPELNY,
    });

    const naglowek =
      `[${String(ev.id).padStart(3)}] ${ascii(ev.name)} (${ascii(ev.slug)})` +
      `  serwer ...${String(ev.guild_id).slice(-6)}`;

    if (!plan.zapisac) {
      pominietych += 1;

      console.log(`${naglowek}\n      POMIJAM: ${OPIS_POWODU[plan.powod]}`);

      if (plan.nieznane?.length) {
        console.log(
          `      bez wiersza w slowniku (${plan.nieznane.length}): ${ascii(
            plan.nieznane.join(", "),
          )}`,
        );
      }

      console.log("");

      continue;
    }

    doZapisu += 1;

    const nazwyZTypow = await nazwyZZapytan(pool, ZAPYTANIA_TYPOW, ev.id);

    const pozaRosterem = typyPozaRosterem({
      nazwyZTypow,
      slownik,
      teamIds: plan.teamIds,
    });

    const aktywnych = slownik.filter((d) => Number(d.active) === 1).length;

    console.log(
      `${naglowek}\n      roster: ${plan.teamIds.length} druzyn ` +
        `(dzis zapas: ${aktywnych} aktywnych)`,
    );

    if (plan.dodane.length) {
      console.log(
        `      DOCHODZA (zagraly, ale sa dzis wylaczone): ${ascii(
          plan.dodane.join(", "),
        )}`,
      );
    }

    if (plan.zabrane.length) {
      console.log(
        `      WYPADAJA (aktywne, ale tu nie zagraly): ${ascii(
          plan.zabrane.join(", "),
        )}`,
      );
    }

    if (plan.nieznane.length) {
      console.log(
        `      ROSTER NIEPELNY, bez wiersza w slowniku (${plan.nieznane.length}): ` +
          ascii(plan.nieznane.join(", ")),
      );
    }

    if (pozaRosterem.length) {
      console.log(
        `      UWAGA - te nazwy sa w zapisanych typach i wypadna z listy wyboru: ` +
          ascii(pozaRosterem.join(", ")),
      );
    }

    if (!ZAPISZ) {
      console.log("");

      continue;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Powtórne sprawdzenie W TRANSAKCJI: między raportem a zapisem ktoś
      // mógł wskazać roster w panelu, a jego decyzja jest ważniejsza.
      const [[{ ile }]] = await conn.query(
        "SELECT COUNT(*) AS ile FROM event_teams WHERE event_id = ? FOR UPDATE",
        [ev.id],
      );

      if (Number(ile) > 0) {
        await conn.rollback();

        console.log("      POMIJAM: roster pojawil sie w trakcie - nie nadpisuje\n");

        doZapisu -= 1;
        pominietych += 1;

        continue;
      }

      // sort_order = pozycja w tablicy, dokładnie jak w trasie panelu.
      const wartosci = plan.teamIds.map((id, index) => [ev.id, id, index + 1]);

      await conn.query(
        "INSERT INTO event_teams (event_id, team_id, sort_order) VALUES ?",
        [wartosci],
      );

      await conn.commit();

      zapisanych += 1;

      console.log(`      ZAPISANO ${wartosci.length} wierszy\n`);
    } catch (err) {
      await conn.rollback();

      throw err;
    } finally {
      conn.release();
    }
  }

  console.log(
    `=== turniejow: ${wybrane.length}, pominietych: ${pominietych}, ` +
      (ZAPISZ
        ? `zapisanych: ${zapisanych}`
        : `do zapisu: ${doZapisu} (puscic z --apply)`),
  );

  await pool.end();
}

main().catch((err) => {
  console.log(`BLAD: ${ascii(err?.code || err?.message || err)}`);

  process.exit(1);
});
