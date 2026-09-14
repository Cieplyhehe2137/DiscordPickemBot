#!/usr/bin/env node
//
// Uzupełnia tabelę `team_logos` adresami logotypów z PandaScore.
//
// Skąd bierze nazwy: z bazy, a nie z listy wpisanej na sztywno - z meczów
// (team_a, team_b) i z opublikowanych wyników faz. To jest komplet nazw, jakie
// mogą trafić na ekran. Dziś jest ich 48.
//
// Domyślnie NIC nie zapisuje. Pokazuje, co by zrobił, i kończy. Żeby zapisał,
// trzeba podać --apply:
//
//   node scripts/fetchTeamLogos.mjs             # podgląd
//   node scripts/fetchTeamLogos.mjs --apply     # zapis do bazy
//
// Skrypt nie wypisuje tokenu i nie nadpisuje wpisów dodanych ręcznie
// (source = 'manual') - to one są sposobem na drużyny, których dostawca nie
// zna albo zna bez obrazka.
//
// Uruchamiać po migracji 0009_add_team_logos.sql.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  normalizeTeamName,
  searchNameFor,
  pickExactTeam,
} from "../server/lib/teamLogos.js";

const require = createRequire(import.meta.url);

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(KATALOG, "..");

require("dotenv").config({ path: path.join(ROOT, "server", ".env") });
require("dotenv").config({ path: path.join(ROOT, ".env") });

const mysql = require("mysql2/promise");

const ZAPISZ = process.argv.includes("--apply");

// Odstęp między zapytaniami do cudzego API. 400 ms to 2,5 zapytania na
// sekundę - przy 48 nazwach cały przebieg trwa dwadzieścia sekund, a limitu
// PandaScore nawet nie dotyka.
const ODSTEP_MS = 400;

const PUSTE = /^[\s\-–—_.]*$/;

function rozbij(value) {
  if (!value) return [];

  return String(value)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter((s) => !PUSTE.test(s));
}

async function zbierzNazwy(pool) {
  const nazwy = new Map();

  const dodaj = (n) => {
    const klucz = normalizeTeamName(n);

    if (!n || !klucz) return;

    // Zapamiętujemy pierwszy napotkany zapis - wiersz i tak jest jeden na
    // znormalizowany klucz.
    if (!nazwy.has(klucz)) nazwy.set(klucz, String(n).trim());
  };

  const [mecze] = await pool.query(
    "SELECT DISTINCT team_a, team_b FROM matches",
  );

  for (const m of mecze) {
    dodaj(m.team_a);
    dodaj(m.team_b);
  }

  const zrodla = [
    ["swiss_results", ["correct_3_0", "correct_0_3", "correct_advancing"]],
    ["playin_results", ["correct_teams"]],
    [
      "playoffs_results",
      [
        "correct_semifinalists",
        "correct_finalists",
        "correct_winner",
        "correct_third_place_winner",
      ],
    ],
    [
      "doubleelim_results",
      ["upper_final_a", "lower_final_a", "upper_final_b", "lower_final_b"],
    ],
  ];

  for (const [tabela, kolumny] of zrodla) {
    const [wiersze] = await pool.query("SELECT * FROM ??", [tabela]);

    for (const w of wiersze) {
      for (const k of kolumny) rozbij(w[k]).forEach(dodaj);
    }
  }

  return [...nazwy.values()].sort((a, b) => a.localeCompare(b));
}

async function szukajUDostawcy(nazwa, token) {
  const url = new URL("https://api.pandascore.co/csgo/teams");

  url.searchParams.set("search[name]", searchNameFor(nazwa));
  url.searchParams.set("per_page", "50");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const tresc = await res.text().catch(() => "");

    throw new Error(`pandascore: HTTP ${res.status} ${tresc.slice(0, 120)}`);
  }

  const paczka = await res.json();

  return Array.isArray(paczka) ? paczka : [];
}

async function main() {
  const token = process.env.PANDASCORE_TOKEN;

  if (!token) {
    console.error("Brak PANDASCORE_TOKEN w server/.env");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 3,
  });

  try {
    const [[tabela]] = await pool.query(
      "SELECT COUNT(*) AS jest FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'team_logos'",
    );

    // Podgląd ma działać PRZED migracją: skoro nic nie zapisuje, brak tabeli
    // go nie dotyczy. Sensem podglądu jest zobaczyć, co skrypt zrobi, zanim
    // cokolwiek zmieni się w bazie - wymaganie tabeli odwracałoby tę kolejność.
    if (!tabela.jest && ZAPISZ) {
      console.error(
        "Brak tabeli team_logos - najpierw migrations/0009_add_team_logos.sql",
      );
      process.exit(1);
    }

    // Wpisy ręczne są ważniejsze od dostawcy i nie wolno ich nadpisać.
    const [reczne] = tabela.jest
      ? await pool.query(
          "SELECT name_key FROM team_logos WHERE source = 'manual'",
        )
      : [[]];

    const chronione = new Set(reczne.map((r) => r.name_key));

    const nazwy = await zbierzNazwy(pool);

    console.log(`Nazw drużyn w bazie: ${nazwy.length}`);
    console.log(`Wpisów ręcznych (nietykalnych): ${chronione.size}`);
    console.log(ZAPISZ ? "TRYB: zapis\n" : "TRYB: podgląd (bez --apply)\n");

    const doZapisu = [];
    const bezLogo = [];
    const nieznane = [];

    for (const nazwa of nazwy) {
      const klucz = normalizeTeamName(nazwa);

      if (chronione.has(klucz)) continue;

      let kandydaci;

      try {
        kandydaci = await szukajUDostawcy(nazwa, token);
      } catch (err) {
        console.error(`  BŁĄD dla "${nazwa}": ${err.message}`);
        nieznane.push(nazwa);
        await new Promise((r) => setTimeout(r, ODSTEP_MS));
        continue;
      }

      const trafiona = pickExactTeam(kandydaci, searchNameFor(nazwa));

      if (trafiona?.image_url) {
        doZapisu.push({
          name: nazwa,
          name_key: klucz,
          canonical_name: trafiona.name,
          logo_url: trafiona.image_url,
        });
      } else if (trafiona) {
        bezLogo.push(`${nazwa} (dostawca zna jako "${trafiona.name}")`);
      } else {
        nieznane.push(nazwa);
      }

      await new Promise((r) => setTimeout(r, ODSTEP_MS));
    }

    console.log(`Z logotypem:        ${doZapisu.length}`);
    console.log(`Znane, bez obrazka: ${bezLogo.length}`);
    console.log(`Nieznane dostawcy:  ${nieznane.length}`);

    if (bezLogo.length) {
      console.log("\nZNANE, ALE BEZ OBRAZKA - do uzupełnienia ręcznie:");
      for (const n of bezLogo) console.log(`  ${n}`);
    }

    if (nieznane.length) {
      console.log("\nNIEZNANE - do uzupełnienia ręcznie:");
      for (const n of nieznane) console.log(`  ${n}`);
    }

    if (!ZAPISZ) {
      console.log("\nNic nie zapisano. Uruchom z --apply, żeby zapisać.");
      return;
    }

    for (const w of doZapisu) {
      await pool.query(
        `
        INSERT INTO team_logos (name, name_key, canonical_name, logo_url, source)
        VALUES (?, ?, ?, ?, 'pandascore')
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          canonical_name = VALUES(canonical_name),
          logo_url = VALUES(logo_url),
          source = 'pandascore'
        `,
        [w.name, w.name_key, w.canonical_name, w.logo_url],
      );
    }

    console.log(`\nZapisano ${doZapisu.length} wierszy.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
