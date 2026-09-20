// Szuka organizacji rozbitych na dwie drużyny.
//
// PO CO OSOBNE NARZĘDZIE. Test w test/teamLogos.test.js pilnuje, żeby każdy
// wpis z TEAM_NAME_ALIASES sklejał się do jednego klucza - i to załatwia
// wszystko, o czym ta lista już wie. Nie załatwia drużyny, o której nikt
// jeszcze nie napisał aliasu: nowy zespół wpisany raz jako „Team X",
// a raz jako „X", rozjedzie się po cichu i nic tego nie zgłosi.
//
// Baza zna odpowiedź. `team_logos.canonical_name` wypełnia fetchTeamLogos.mjs
// nazwą, pod którą prowadzi zespół dostawca logotypów - i dla obu zapisów
// jest ona TA SAMA:
//
//   name_key           canonical_name
//   liquid             Liquid
//   teamliquid         Liquid          <- ten sam klub, inny klucz
//
// Tak wyszły trzy rozbicia naraz: Liquid, Lynn Vision i NAVI. Narzędzie
// robi z tego sprawdzenie, zamiast czekać, aż ktoś zauważy na stronie dwie
// drużyny o jednej nazwie.
//
// WYŁĄCZNIE ODCZYT. Niczego nie zapisuje i niczego nie naprawia - dopisanie
// sklejenia to decyzja, bo kierunek trzeba wybrać.
//
// Uruchomienie:
//   node server/tools/checkTeamKeys.mjs
//
// Zwraca 1, gdy coś się nie zgadza.

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

import { teamKey } from "../lib/teamLogos.js";

const KATALOG_SERWERA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

dotenv.config({ path: path.join(KATALOG_SERWERA, ".env"), quiet: true });

const pula = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 2,
});

let kod = 0;

try {
  const [wiersze] = await pula.query(
    `SELECT name, name_key, canonical_name
       FROM team_logos
      WHERE canonical_name IS NOT NULL AND canonical_name <> ''`,
  );

  // Grupujemy po odpowiedzi dostawcy, a potem patrzymy, czy nasze klucze
  // w każdej grupie są zgodne.
  const grupy = new Map();

  for (const w of wiersze) {
    const g = String(w.canonical_name).trim().toLowerCase();

    if (!grupy.has(g)) grupy.set(g, []);

    grupy.get(g).push(w);
  }

  const rozbite = [];

  for (const [canonical, czlonkowie] of grupy) {
    const klucze = new Set(czlonkowie.map((w) => teamKey(w.name_key)));

    if (klucze.size > 1) rozbite.push({ canonical, czlonkowie, klucze });
  }

  console.log(
    `[klucze] ${wiersze.length} wierszy w team_logos, ${grupy.size} organizacji`,
  );

  if (rozbite.length === 0) {
    console.log("[klucze] zadna organizacja nie jest rozbita na dwa klucze");
  } else {
    kod = 1;

    for (const r of rozbite) {
      console.error(`\n[klucze] ROZBITE: "${r.canonical}" ma ${r.klucze.size} klucze`);

      for (const w of r.czlonkowie) {
        console.error(`           ${w.name_key.padEnd(24)} -> ${teamKey(w.name_key)}   (${w.name})`);
      }

      console.error(
        "           dopisz sklejenie w TEAM_KEY_MERGES (server/lib/teamLogos.js)",
      );
    }
  }
} catch (err) {
  console.error(`[klucze] nie udalo sie sprawdzic: ${err.message}`);

  kod = 2;
} finally {
  await pula.end();
}

process.exit(kod);
