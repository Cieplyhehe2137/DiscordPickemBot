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
// TO SAMO ROBI SAM WATCHER W BOCIE (handlers/matches/matchMapsWatcher.js),
// co trzydzieści minut w trakcie turnieju. Ten skrypt zostaje do trzech
// rzeczy: zobaczyć, co automat zrobi, zanim to zrobi; nadrobić turniej
// z przeszłości, którego watcher już nie tknie (odpuszcza mecze starsze
// niż trzy dni - tutaj zmienia to `--dni`); i uzupełnić mapy, gdy bot
// akurat nie chodzi.
//
// JEDNO ZAPYTANIE NA TURNIEJ. Mapy przychodzą w liście meczów eventu, więc
// synchronizacja 42 meczów kosztuje jedno zapytanie z limitu 500 na miesiąc,
// a nie czterdzieści dwa. Drugie idzie tylko na odnalezienie turnieju
// u dostawcy - można je pominąć, podając `--cito-event`.
//
// JEDNA DROGA ZAPISU. Parowanie i zapis siedzą w server/lib/mapSync.js,
// wspólnym z watcherem. Dwie kopie tej samej logiki rozjechałyby się
// o jeden warunek - ten projekt zapłacił już za taką pomyłkę pół roku
// błędu (patrz server/lib/startTime.js).

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { syncEventMaps, OKNO_DNI } from "../server/lib/mapSync.js";

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

// Skrypt uruchamia człowiek, więc może sięgnąć dalej wstecz niż watcher -
// nadrobienie zakończonego turnieju jest jednym z powodów, dla których ten
// plik istnieje.
const DNI = Number(opcja("--dni") || 0) || OKNO_DNI;

let zuzyte = 0;

/** Wołanie sieci wstrzykiwane do mapSync. */
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

function naglowek(tekst) {
  console.log(`\n=== ${tekst} ===`);
}

const main = async () => {
  const key = process.env.CITO_API_KEY;

  if (!key) {
    console.error(
      "Brak CITO_API_KEY.\n\n" +
        "Darmowy klucz: https://citoapi.com/signup/?game=cs2\n" +
        "Plan Free: 500 zapytań na miesiąc, bez karty.\n\n" +
        "Wpisz go jako CITO_API_KEY=... do .env W KORZENIU PROJEKTU -\n" +
        "tam szuka go także watcher w bocie, który czyta tylko ten plik.\n" +
        "Ten skrypt czyta oba (.env i server/.env), więc zadziała tak i tak,\n" +
        "ale klucz w samym server/.env nie uruchomi watchera.",
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

    console.log("okno:", DNI, "dni wstecz od startu meczu");

    const raport = await syncEventMaps({
      pool: pula,
      event,
      key,
      wolaj,
      apply: ZAPIS,
      eventId: CITO_EVENT,
      oknoDni: DNI,
    });

    if (!raport.ok) {
      console.log("\nNIC NIE ZROBIONO:", raport.powod);

      if (/nie zna tego turnieju/.test(String(raport.powod))) {
        console.log(
          "\nIch nazwa turnieju musi zgadzać się DOKŁADNIE z naszą.\n" +
            "Jeśli nazywają go inaczej, podaj identyfikator wprost:\n" +
            "  --cito-event cs2-event-XXXX",
        );
      }

      console.log("zapytań zużytych:", zuzyte);

      return;
    }

    if (!raport.plan?.length && !raport.bezPary?.length) {
      console.log("\n" + (raport.powod || "nie ma czego uzupełniać"));
      console.log("zapytań zużytych:", zuzyte);

      return;
    }

    naglowek("DOPASOWANIE");

    console.log("sparowanych z mapami:", raport.plan.length);
    console.log("bez pary:", raport.bezPary.length);

    if (raport.plan.length) {
      console.log("\nnr | mapy (kto pickował)");

      for (const p of raport.plan) {
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

    if (raport.bezPary.length) {
      console.log("\nbez pary:");

      for (const m of raport.bezPary.slice(0, 10)) {
        console.log(
          " ",
          String(m.match_no).padStart(2),
          `${m.team_a} vs ${m.team_b}`.padEnd(26),
          "-",
          m.powod,
        );
      }
    }

    if (raport.podglad) {
      console.log(
        `\nPODGLĄD - nic nie zapisano. Zapytań zużytych: ${zuzyte}.\n` +
          "Uruchom z --apply, żeby zapisać.",
      );

      return;
    }

    naglowek("ZAPIS");

    console.log("zapisanych wierszy map:", raport.zapisanych);
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
