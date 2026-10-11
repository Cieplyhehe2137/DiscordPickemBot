#!/usr/bin/env node
//
// Dociąga MAPY ROZEGRANE PO VETO z CitoAPI i uzupełnia `match_maps`.
//
//   node scripts/fetchMatchMaps.mjs --event epl-season24            # podgląd
//   node scripts/fetchMatchMaps.mjs --event epl-season24 --apply    # zapis
//
// DOMYŚLNIE NIC NIE ZAPISUJE. Pokazuje, co by zrobił, i kończy - tak samo
// jak scripts/fetchTeamLogos.mjs.
//
// JEDNO ZAPYTANIE NA TURNIEJ. Mapy przychodzą w liście meczów eventu, więc
// synchronizacja 42 meczów kosztuje jedno zapytanie z limitu 500 na miesiąc,
// a nie czterdzieści dwa. Drugie zapytanie idzie tylko wtedy, gdy trzeba
// odnaleźć turniej u dostawcy - można to pominąć, podając --cito-event.
//
// RĘKA WYGRYWA. Wierszy `source = 'manual'` skrypt NIE RUSZA - administrator
// wpisuje mapy z transmisji, często szybciej, niż trafiają gdziekolwiek
// indziej. Pilnuje tego zarówno filtr przy wyborze meczów, jak i warunek
// w samym zapytaniu zapisującym.
//
// PICKERÓW NIE ZGADUJEMY. To jest cały powód, dla którego ten skrypt
// istnieje: wyliczenie "mapa 1 to pick drużyny A" ma 58% trafności
// (zmierzone na 113 mapach), a dostawca podaje prawdę.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

import {
  ZRODLO,
  LIMIT_NA_MIESIAC,
  buildEventMatchesRequest,
  extractMatches,
  findRecordForMatch,
  mapsForOurMatch,
} from "../server/lib/mapProviders/cito.js";

import { buildMatchMaps } from "../server/lib/matchMaps.js";

const require = createRequire(import.meta.url);

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(KATALOG, "..");

require("dotenv").config({ path: path.join(ROOT, "server", ".env") });
require("dotenv").config({ path: path.join(ROOT, ".env") });

const mysql = require("mysql2/promise");

const ARG = process.argv.slice(2);
const ZAPIS = ARG.includes("--apply");

function opcja(nazwa) {
  const i = ARG.indexOf(nazwa);

  return i !== -1 ? ARG[i + 1] : null;
}

const SLUG = opcja("--event");
const CITO_EVENT = opcja("--cito-event");

const API = "https://api.citoapi.com/api/v1";

let zuzyte = 0;

function naglowek(tekst) {
  console.log(`\n=== ${tekst} ===`);
}

async function wolaj(url, headers) {
  zuzyte += 1;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const tresc = await res.text().catch(() => "");

    // Treść błędu bywa echem zapytania - przycinamy, żeby nie wypisać
    // przypadkiem niczego z nagłówków.
    throw new Error(`cito: HTTP ${res.status} ${tresc.slice(0, 160)}`);
  }

  return res.json();
}

/** Odnajduje turniej u dostawcy po nazwie. Jedno dodatkowe zapytanie. */
async function znajdzTurniej(key, nazwa) {
  const url = new URL(`${API}/cs2/search`);

  url.searchParams.set("q", nazwa);

  const dane = await wolaj(url.toString(), {
    "x-api-key": key,
    Accept: "application/json",
  });

  return dane?.data?.events || [];
}

const main = async () => {
  const key = process.env.CITO_API_KEY;

  if (!key) {
    console.error(
      "Brak CITO_API_KEY.\n\n" +
        "Darmowy klucz: https://citoapi.com/signup/?game=cs2\n" +
        "Plan Free: 500 zapytań na miesiąc, bez karty.\n" +
        "Wpisz go do server/.env jako CITO_API_KEY=...",
    );
    process.exit(1);
  }

  if (!SLUG) {
    console.error("Podaj turniej: --event <slug>");
    process.exit(1);
  }

  const pula = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 2,
    dateStrings: true,
  });

  try {
    const [[event]] = await pula.query(
      "SELECT id, slug, name FROM events WHERE slug = ? LIMIT 1",
      [SLUG],
    );

    if (!event) {
      console.error(`Nie ma turnieju o slugu "${SLUG}".`);
      process.exit(1);
    }

    naglowek(`TURNIEJ ${event.name} (${event.slug})`);

    // Mecze, które jeszcze nie mają kompletu map. Wiersze `manual` liczą się
    // jako gotowe - ręka wygrywa.
    const [mecze] = await pula.query(
      `
      SELECT
        m.id, m.guild_id, m.event_id, m.match_no, m.best_of,
        m.team_a, m.team_b, m.start_time_utc,
        (SELECT COUNT(*) FROM match_maps mm WHERE mm.match_id = m.id) AS map_rows,
        (SELECT COUNT(*) FROM match_maps mm
          WHERE mm.match_id = m.id AND mm.source = 'manual') AS manual_rows
      FROM matches m
      WHERE m.event_id = ?
        AND m.start_time_utc IS NOT NULL
      ORDER BY m.match_no
      `,
      [event.id],
    );

    const doZrobienia = mecze.filter(
      (m) => Number(m.manual_rows) === 0 && Number(m.map_rows) < m.best_of,
    );

    console.log("meczów z godziną:", mecze.length);
    console.log("bez kompletu map (i bez wpisu ręcznego):", doZrobienia.length);

    if (!doZrobienia.length) {
      console.log("\nNie ma czego uzupełniać.");

      return;
    }

    /* ---------------- turniej u dostawcy ---------------- */

    let idTurnieju = CITO_EVENT;

    if (!idTurnieju) {
      naglowek("SZUKANIE TURNIEJU U DOSTAWCY");

      const kandydaci = await znajdzTurniej(key, event.name);

      for (const k of kandydaci.slice(0, 6)) {
        console.log(" ", k.id, "|", k.name, "| drużyn:", k.teamCount);
      }

      // Dokładna nazwa wygrywa; inaczej bierzemy pierwszego kandydata
      // i mówimy o tym wprost.
      const dokladny = kandydaci.find(
        (k) =>
          String(k.name || "").trim().toLowerCase() ===
          String(event.name || "").trim().toLowerCase(),
      );

      idTurnieju = (dokladny || kandydaci[0])?.id;

      if (!idTurnieju) {
        console.log(
          "\nNie znaleźli tego turnieju. Podaj identyfikator ręcznie:\n" +
            "  --cito-event cs2-event-XXXX",
        );

        return;
      }

      console.log(
        "\nbiorę:",
        idTurnieju,
        dokladny ? "(nazwa zgadza się dokładnie)" : "(PIERWSZY z listy - sprawdź!)",
      );
    }

    /* ---------------- jedno zapytanie o wszystko ---------------- */

    naglowek("POBIERANIE");

    const zadanie = buildEventMatchesRequest({ key, eventId: idTurnieju });

    if (!zadanie.ok) {
      console.error(zadanie.reason);

      return;
    }

    const odpowiedz = await wolaj(zadanie.url, zadanie.headers);
    const ichMecze = extractMatches(odpowiedz);

    console.log("ich meczów:", ichMecze.length);
    console.log(
      "ich map razem:",
      ichMecze.reduce((s, m) => s + (m.maps?.length || 0), 0),
    );

    /* ---------------- parowanie ---------------- */

    naglowek("DOPASOWANIE");

    const plan = [];
    const bezPary = [];

    for (const nasz of doZrobienia) {
      const znalezione = findRecordForMatch({ nasz, rekordy: ichMecze });

      if (!znalezione.ok) {
        bezPary.push({ ...nasz, powod: znalezione.reason });
        continue;
      }

      const rekord = znalezione.rekord;

      const { names, pickers } = mapsForOurMatch({ nasz, rekord });

      if (!names.some((n) => n)) {
        bezPary.push({ ...nasz, powod: "sparowany, ale bez nazw map" });
        continue;
      }

      const zbudowane = buildMatchMaps({
        bestOf: nasz.best_of,
        names: names.slice(0, nasz.best_of),
        pickers: pickers.slice(0, nasz.best_of),
        source: ZRODLO,
      });

      if (!zbudowane.ok) {
        bezPary.push({ ...nasz, powod: zbudowane.reason });
        continue;
      }

      plan.push({ nasz, rows: zbudowane.rows, unknown: zbudowane.unknown });
    }

    console.log("sparowanych z mapami:", plan.length);
    console.log("bez pary:", bezPary.length);

    if (plan.length) {
      console.log("\nnr | mapy (kto pickował)");

      for (const p of plan) {
        const opis = p.rows
          .map((r) => {
            const kto =
              r.picked_by === "TEAM_A"
                ? p.nasz.team_a
                : r.picked_by === "TEAM_B"
                  ? p.nasz.team_b
                  : "decider";

            return `${r.map_name} (${kto})`;
          })
          .join(", ");

        console.log(
          String(p.nasz.match_no).padStart(2),
          "|",
          opis + (p.unknown.length ? `   [nieznane: ${p.unknown.join(", ")}]` : ""),
        );
      }
    }

    if (bezPary.length) {
      console.log("\nbez pary:");

      for (const m of bezPary.slice(0, 10)) {
        console.log(
          " ",
          String(m.match_no).padStart(2),
          `${m.team_a} vs ${m.team_b}`.padEnd(26),
          "-",
          m.powod,
        );
      }
    }

    if (!ZAPIS) {
      console.log(
        `\nPODGLĄD - nic nie zapisano. Zapytań zużytych: ${zuzyte} ` +
          `(budżet ${LIMIT_NA_MIESIAC}/mies.)\n` +
          "Uruchom z --apply, żeby zapisać.",
      );

      return;
    }

    /* ---------------- zapis ---------------- */

    naglowek("ZAPIS");

    let zapisanych = 0;

    for (const p of plan) {
      for (const r of p.rows) {
        // `manual` chronimy warunkiem W SAMYM ZAPYTANIU, a nie tylko
        // filtrem wyżej - między odczytem a zapisem administrator mógł
        // zdążyć coś wpisać.
        const [wynik] = await pula.query(
          `
          INSERT INTO match_maps
            (guild_id, event_id, match_id, map_no, map_name, picked_by, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            map_name  = IF(match_maps.source = 'manual', match_maps.map_name, VALUES(map_name)),
            picked_by = IF(match_maps.source = 'manual', match_maps.picked_by, VALUES(picked_by)),
            source    = IF(match_maps.source = 'manual', match_maps.source, VALUES(source))
          `,
          [
            p.nasz.guild_id,
            p.nasz.event_id,
            p.nasz.id,
            r.map_no,
            r.map_name,
            r.picked_by,
            r.source,
          ],
        );

        if (wynik.affectedRows) zapisanych += 1;
      }
    }

    console.log("zapisanych wierszy map:", zapisanych);
    console.log("zapytań zużytych:", zuzyte);
  } finally {
    await pula.end();
  }
};

main().catch((e) => {
  console.error("BŁĄD:", e.message);
  console.error("zapytań zużytych:", zuzyte);
  process.exit(1);
});
