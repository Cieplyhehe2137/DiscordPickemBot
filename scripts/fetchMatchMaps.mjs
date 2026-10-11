#!/usr/bin/env node
//
// Dociąga MAPY ROZEGRANE PO VETO z Liquipedii i uzupełnia `match_maps`.
//
//   node scripts/fetchMatchMaps.mjs --event epl-season24            # podgląd
//   node scripts/fetchMatchMaps.mjs --event epl-season24 --apply    # zapis
//
// DOMYŚLNIE NIC NIE ZAPISUJE. Pokazuje, co by zrobił, i kończy - tak samo
// jak scripts/fetchTeamLogos.mjs.
//
// ===========================================================================
// PIERWSZE URUCHOMIENIE JEST SPRAWDZENIEM, NIE ROBOTĄ.
//
// Kształt odpowiedzi LPDB nie został zweryfikowany: Liquipedia udostępnia
// szczegółową dokumentację dopiero po przyznaniu klucza, a czytania ich
// stron HTML zabrania regulamin (i serwer odrzuca - sprawdzone, HTTP 403).
// Ścieżki, pod którymi szukamy nazw map, są więc PRAWDOPODOBNE, nie pewne.
//
// Dlatego skrypt odkłada surową odpowiedź do pliku i wypisuje, która ścieżka
// zadziałała. Po pierwszym przebiegu trzeba zajrzeć do tego pliku, dopisać
// prawdziwy kształt jako fiksturę w test/liquipediaMaps.test.js i zwęzić
// ścieżki w server/lib/mapProviders/liquipedia.js do tej jednej, która
// naprawdę występuje.
// ===========================================================================
//
// WARUNKI REGULAMINU, których ten skrypt przestrzega:
//   - klucz idzie nagłówkiem, nigdy w adresie;
//   - własny User-Agent;
//   - najwyżej 60 zapytań na godzinę (trzymamy się 50);
//   - wyniki buforujemy - jedno zapytanie na turniej, nie na mecz;
//   - dane są na CC-BY-SA 3.0, więc źródło widać na stronie meczu.
//
// RĘKA WYGRYWA. Wierszy `source = 'manual'` skrypt NIE RUSZA - administrator
// wpisuje mapy z transmisji, często szybciej, niż trafiają gdziekolwiek
// indziej.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

import {
  ZRODLO,
  LIMIT_NA_GODZINE,
  buildLpdbRequest,
  extractMapsFromMatch,
  matchesOurMatch,
} from "../server/lib/mapProviders/liquipedia.js";

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

// Jak nazywa się ten turniej po stronie Liquipedii. Bez tego nie ma czego
// pytać - ich baza nie zna naszych slugów.
const STRONA = opcja("--page");

const PLIK_PROBKI = path.join(ROOT, "scripts", "liquipedia-probka.json");

function naglowek(tekst) {
  console.log(`\n=== ${tekst} ===`);
}

async function pobierzZDostawcy(key, conditions) {
  const zadanie = buildLpdbRequest({
    key,
    datapoint: "match",
    wiki: "counterstrike",
    conditions,
    limit: 200,
  });

  if (!zadanie.ok) throw new Error(zadanie.reason);

  const res = await fetch(zadanie.url, { headers: zadanie.headers });

  if (!res.ok) {
    const tresc = await res.text().catch(() => "");

    // Treść błędu bywa echem zapytania - przycinamy, żeby nie wypisać
    // przypadkiem niczego z nagłówków.
    throw new Error(`liquipedia: HTTP ${res.status} ${tresc.slice(0, 160)}`);
  }

  return res.json();
}

const main = async () => {
  const key = process.env.LIQUIPEDIA_API_KEY;

  if (!key) {
    console.error(
      "Brak LIQUIPEDIA_API_KEY.\n\n" +
        "Klucz do LPDB przyznaje Liquipedia na wniosek (liquipedia.net/api).\n" +
        "Darmowy dostęp jest zastrzeżony dla niekomercyjnych serwisów\n" +
        "społecznościowych - pickembot.pl takim jest. Po otrzymaniu klucza\n" +
        "dopisz go do server/.env jako LIQUIPEDIA_API_KEY=...",
    );
    process.exit(1);
  }

  if (!SLUG) {
    console.error("Podaj turniej: --event <slug>");
    process.exit(1);
  }

  if (!STRONA) {
    console.error(
      "Podaj nazwę turnieju u Liquipedii: --page <nazwa>\n" +
        'Na przykład: --page "ESL/Pro League/Season 24"\n\n' +
        "Ich baza nie zna naszych slugów, więc trzeba powiedzieć wprost,\n" +
        "o który turniej pytamy.",
    );
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

    naglowek(`TURNIEJ ${event.name} (${event.slug})`);

    console.log("meczów z godziną:", mecze.length);

    const doZrobienia = mecze.filter(
      (m) => Number(m.manual_rows) === 0 && Number(m.map_rows) < m.best_of,
    );

    console.log("bez kompletu map (i bez wpisu ręcznego):", doZrobienia.length);

    if (!doZrobienia.length) {
      console.log("\nNie ma czego uzupełniać.");

      return;
    }

    // JEDNO zapytanie na turniej, nie na mecz - regulamin wymaga
    // buforowania i zakazuje pytania dwa razy o to samo. Przy czterdziestu
    // meczach to różnica między 1 a 40 zapytaniami z budżetu 60/h.
    naglowek("PYTANIE DO DOSTAWCY");

    console.log("budżet:", LIMIT_NA_GODZINE, "zapytań/h | używamy: 1");

    const odpowiedz = await pobierzZDostawcy(
      key,
      `[[parent::${STRONA}]]`,
    );

    const rekordy = Array.isArray(odpowiedz)
      ? odpowiedz
      : odpowiedz?.result || odpowiedz?.data || [];

    console.log("rekordów w odpowiedzi:", rekordy.length);

    // Surowa odpowiedź na dysk - to jest sposób, żeby potwierdzić kształt.
    fs.writeFileSync(
      PLIK_PROBKI,
      JSON.stringify(rekordy.slice(0, 3), null, 2),
      "utf8",
    );

    console.log("próbka (3 rekordy) zapisana:", path.relative(ROOT, PLIK_PROBKI));

    if (!rekordy.length) {
      console.log(
        "\nZero rekordów. Sprawdź nazwę turnieju podaną w --page -\n" +
          "musi być dokładnie taka, jak w adresie strony Liquipedii.",
      );

      return;
    }

    naglowek("DOPASOWANIE");

    const plan = [];
    const bezPary = [];

    for (const nasz of doZrobienia) {
      const rekord = rekordy.find(
        (r) => matchesOurMatch({ nasz, rekord: r }).ok,
      );

      if (!rekord) {
        bezPary.push(nasz);
        continue;
      }

      const { names, path: sciezka } = extractMapsFromMatch(rekord);

      if (!names.length) {
        bezPary.push({ ...nasz, powod: "sparowany, ale bez nazw map" });
        continue;
      }

      const zbudowane = buildMatchMaps({
        bestOf: nasz.best_of,
        names: names.slice(0, nasz.best_of),
        source: ZRODLO,
      });

      if (!zbudowane.ok) {
        bezPary.push({ ...nasz, powod: zbudowane.reason });
        continue;
      }

      plan.push({ nasz, rows: zbudowane.rows, sciezka, unknown: zbudowane.unknown });
    }

    console.log("sparowanych z mapami:", plan.length);
    console.log("bez pary:", bezPary.length);

    if (plan.length) {
      console.log("\nktóra ścieżka zadziałała:", plan[0].sciezka);
      console.log("\nnr | mapy");

      for (const p of plan) {
        console.log(
          String(p.nasz.match_no).padStart(2),
          "|",
          p.rows.map((r) => `${r.map_no}:${r.map_name}`).join("  ") +
            (p.unknown.length ? `   (nieznane: ${p.unknown.join(", ")})` : ""),
        );
      }
    }

    if (bezPary.length) {
      console.log("\nbez pary:");

      for (const m of bezPary.slice(0, 10)) {
        console.log(
          " ",
          String(m.match_no).padStart(2),
          m.team_a,
          "vs",
          m.team_b,
          m.powod ? `- ${m.powod}` : "",
        );
      }
    }

    if (!ZAPIS) {
      console.log(
        "\nPODGLĄD - nic nie zapisano. Zajrzyj do próbki, potwierdź kształt,\n" +
          "a potem uruchom z --apply.",
      );

      return;
    }

    naglowek("ZAPIS");

    let zapisanych = 0;

    for (const p of plan) {
      for (const r of p.rows) {
        // `manual` chronimy warunkiem w samym zapytaniu, a nie tylko
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
  } finally {
    await pula.end();
  }
};

main().catch((e) => {
  console.error("BŁĄD:", e.message);
  process.exit(1);
});
