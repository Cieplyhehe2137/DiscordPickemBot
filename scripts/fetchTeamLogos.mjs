#!/usr/bin/env node
//
// Uzupełnia tabelę `team_logos` adresami logotypów z PandaScore.
//
// Skąd bierze nazwy: z bazy, a nie z listy wpisanej na sztywno - z meczów,
// z opublikowanych wyników faz I Z TYPÓW. Te trzy źródła razem to komplet
// nazw, jakie mogą trafić na ekran; dziś jest ich 46.
//
// Same mecze i wyniki to za mało - drugą połowę strony drużyn zbudowały
// typy na fazy. Trzy zespoły, które zagrały wyłącznie StarLadder Budapest
// 2025 i nie trafiły do żadnej poprawnej odpowiedzi, miały własne strony
// i 596 typów, a logotypu nie miały skąd wziąć.
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

  // SKĄD BIORĄ SIĘ NAZWY: ze wszystkiego, co może trafić na ekran.
  //
  // Mecze i OPUBLIKOWANE WYNIKI faz to nie jest komplet. Drużyna, która
  // zagrała turniej bez zapisanych meczów i nie znalazła się w żadnej
  // poprawnej odpowiedzi, nie występuje w żadnym z tych dwóch miejsc -
  // a mimo to ma na stronie własną kartę i własną stronę, bo zbudowały ją
  // TYPY. Trzy takie zostały bez logotypu: Fluxo, RED Canids i The Huns
  // Esports, razem 596 typów fazowych.
  //
  // Dlatego czytamy też tabele typów. Źródłem nazw jest tam roster serwera,
  // a ten potrafi być śmieciem - na produkcji stało w nim "DFGDFGDFGS"
  // (patrz test/phaseTeamsSource.test.js). Nic złego się jednak nie stanie:
  // nazwa, której dostawca nie zna, ląduje w kubełku "nieznane" i NIE jest
  // zapisywana. Zmierzone przy tej zmianie: nazw występujących wyłącznie
  // w typach jest dokładnie trzy i wszystkie trzy są prawdziwymi zespołami.
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

    ["swiss_predictions", ["pick_3_0", "pick_0_3", "advancing"]],
    ["playin_predictions", ["teams"]],
    [
      "playoffs_predictions",
      ["semifinalists", "finalists", "winner", "third_place_winner"],
    ],
    [
      "doubleelim_predictions",
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

    // Nieudane zapytanie do dostawcy ma WŁASNY kubełek, osobny od "nieznane".
    //
    // Wcześniej lądowało razem z nimi, więc przebieg, któremu wysypało się
    // trzydzieści zapytań, wypisywał trzydzieści drużyn pod nagłówkiem
    // "NIEZNANE - do uzupełnienia ręcznie" i kończył komunikatem "Zapisano
    // 15 wierszy" - czyli wyglądał na udany. Zdarzyło się to 2026-09-16: te
    // same nazwy poszły bez problemu w kolejnym przebiegu chwilę później,
    // a w międzyczasie ktoś mógł zacząć dopisywać im wiersze ręcznie.
    //
    // Zapis jest idempotentny (ON DUPLICATE KEY UPDATE), więc odpowiedzią na
    // ten kubełek jest zawsze to samo: uruchomić jeszcze raz.
    const bledy = [];

    for (const nazwa of nazwy) {
      const klucz = normalizeTeamName(nazwa);

      if (chronione.has(klucz)) continue;

      let kandydaci;

      try {
        kandydaci = await szukajUDostawcy(nazwa, token);
      } catch (err) {
        console.error(`  BŁĄD dla "${nazwa}": ${err.message}`);
        bledy.push({ nazwa, powod: err.message });
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
    console.log(`Błąd zapytania:     ${bledy.length}`);

    if (bezLogo.length) {
      console.log("\nZNANE, ALE BEZ OBRAZKA - do uzupełnienia ręcznie:");
      for (const n of bezLogo) console.log(`  ${n}`);
    }

    if (nieznane.length) {
      console.log("\nNIEZNANE - do uzupełnienia ręcznie:");
      for (const n of nieznane) console.log(`  ${n}`);
    }

    if (bledy.length) {
      console.log(
        "\nBŁĄD ZAPYTANIA - to NIE znaczy, że dostawca ich nie zna.\n" +
          "Przebieg je pominął. Uruchom go jeszcze raz, żeby je dobrać:",
      );

      for (const b of bledy) console.log(`  ${b.nazwa} - ${b.powod}`);
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

    // Ostatnia linia musi mówić prawdę o całości przebiegu. Samo "Zapisano
    // 15 wierszy" czyta się jak sukces także wtedy, gdy trzydzieści nazw
    // w ogóle nie doszło do dostawcy.
    if (bledy.length) {
      console.log(
        `PRZEBIEG NIEPEŁNY: ${bledy.length} nazw nie sprawdzono. Uruchom ponownie.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
