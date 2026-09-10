#!/usr/bin/env node
//
// Wyciąga wartości wspólne z config/<slug>.env do config/_base.env.
//
// Do tej pory dane bazy, token bota i client id były powtórzone w każdym
// pliku serwera - jedna wartość żyła w kilku miejscach naraz, więc rotacja
// hasła wymagała trafienia we wszystkie, a pominięcie jednego objawiłoby się
// dopiero na jednej gildii.
//
// Skrypt NIE wypisuje wartości. Pokazuje wyłącznie nazwy kluczy.
//
// Domyślnie jest to podgląd - żeby cokolwiek zapisał, trzeba podać --apply.
// Przed zapisem robi kopię wszystkich plików, a po zapisie sprawdza, czy
// efektywna konfiguracja każdej gildii jest identyczna jak przed zmianą.
// Jeżeli cokolwiek się nie zgadza, przywraca kopię i kończy błędem.
//
//   node scripts/rozdzielConfigi.js            # podgląd
//   node scripts/rozdzielConfigi.js --apply    # zapis

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const PLIK_BAZOWY = "_base.env";

// Klucze, które wolno przenieść do pliku wspólnego. Świadomie NIE jest to
// "wszystko, co wyszło identyczne" - dwa serwery mogą dziś przypadkiem mieć
// ten sam ADMIN_PIN albo ten sam kanał logów, a to nie znaczy, że mają go
// współdzielić na zawsze.
const WSPOLNE = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "DISCORD_TOKEN",
  "CLIENT_ID",
];

function katalogConfigu() {
  const dir = process.env.GUILD_CONFIG_DIR || "config";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

function skrot(wartosc) {
  return crypto
    .createHash("sha256")
    .update(String(wartosc))
    .digest("hex")
    .slice(0, 12);
}

function plikiGildii(katalog) {
  return fs
    .readdirSync(katalog)
    .filter((f) => f.toLowerCase().endsWith(".env"))
    .filter((f) => f.toLowerCase() !== PLIK_BAZOWY)
    .map((f) => path.join(katalog, f));
}

// Odcisk efektywnej konfiguracji: wszystkie pary klucz-wartość, posortowane,
// zahaszowane. Porównujemy go przed i po, żeby mieć pewność, że rozdzielenie
// niczego nie zmieniło.
function odcisk(cfg) {
  const pary = Object.entries(cfg)
    .filter(([k]) => k !== "__file")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);

  return skrot(pary.join("\n"));
}

function wczytajRegistry() {
  // Rejestr cache'uje configi, więc przy drugim odczycie trzeba go wyczyścić.
  delete require.cache[require.resolve("../utils/guildRegistry")];

  const registry = require("../utils/guildRegistry");
  const wszystkie = registry.getAllGuildConfig();
  const wynik = {};

  for (const [guildId, cfg] of Object.entries(wszystkie)) {
    wynik[guildId] = odcisk(cfg);
  }

  return wynik;
}

function main() {
  const zapis = process.argv.includes("--apply");
  const katalog = katalogConfigu();

  if (!fs.existsSync(katalog)) {
    console.error(`Nie znaleziono katalogu configu: ${katalog}`);
    process.exit(1);
  }

  const sciezkaBazy = path.join(katalog, PLIK_BAZOWY);

  if (fs.existsSync(sciezkaBazy)) {
    console.error(
      `${PLIK_BAZOWY} już istnieje. Skrypt jest jednorazowy - usuń go albo ` +
        `rozdziel resztę ręcznie.`,
    );
    process.exit(1);
  }

  const pliki = plikiGildii(katalog);

  if (pliki.length < 2) {
    console.error(
      `Znaleziono ${pliki.length} plików gildii - nie ma czego rozdzielać.`,
    );
    process.exit(1);
  }

  const parsowane = pliki.map((f) => ({
    sciezka: f,
    nazwa: path.basename(f),
    dane: dotenv.parse(fs.readFileSync(f, "utf8")),
  }));

  // ==================================================
  // CO JEST WSPÓLNE
  // ==================================================

  const doPrzeniesienia = [];
  const pominiete = [];

  for (const klucz of WSPOLNE) {
    const wartosci = parsowane.map((p) => p.dane[klucz]);
    const obecneWszedzie = wartosci.every(
      (v) => v !== undefined && String(v).trim() !== "",
    );

    if (!obecneWszedzie) {
      pominiete.push(`${klucz} — nie ma go we wszystkich plikach`);
      continue;
    }

    const unikalne = new Set(wartosci.map(String));

    if (unikalne.size !== 1) {
      pominiete.push(`${klucz} — wartości się różnią między serwerami`);
      continue;
    }

    doPrzeniesienia.push({ klucz, wartosc: String(wartosci[0]) });
  }

  console.log(`Katalog:  ${katalog}`);
  console.log(`Serwery:  ${parsowane.map((p) => p.nazwa).join(", ")}`);
  console.log("");

  if (!doPrzeniesienia.length) {
    console.log("Nie ma nic do przeniesienia.");
    pominiete.forEach((p) => console.log(`  pominięte: ${p}`));
    return;
  }

  console.log(`Do ${PLIK_BAZOWY} trafi ${doPrzeniesienia.length} kluczy:`);
  doPrzeniesienia.forEach(({ klucz, wartosc }) =>
    console.log(`  ${klucz.padEnd(16)} (identyczny wszędzie, skrót ${skrot(wartosc)})`),
  );

  if (pominiete.length) {
    console.log("");
    console.log("Zostają w plikach serwerów:");
    pominiete.forEach((p) => console.log(`  ${p}`));
  }

  const kluczeDoUsuniecia = new Set(doPrzeniesienia.map((d) => d.klucz));

  console.log("");
  for (const p of parsowane) {
    const zostanie = Object.keys(p.dane).filter(
      (k) => !kluczeDoUsuniecia.has(k),
    );
    console.log(
      `  ${p.nazwa.padEnd(20)} ${Object.keys(p.dane).length} -> ${zostanie.length} kluczy`,
    );
  }

  if (!zapis) {
    console.log("");
    console.log("To był podgląd. Uruchom z --apply, żeby zapisać.");
    return;
  }

  // ==================================================
  // ODCISK PRZED ZMIANĄ
  // ==================================================

  const przed = wczytajRegistry();

  // ==================================================
  // KOPIA ZAPASOWA
  // ==================================================

  const stempel = new Date().toISOString().replace(/[:.]/g, "-");
  const katalogKopii = path.join(katalog, `.kopia-${stempel}`);

  fs.mkdirSync(katalogKopii, { recursive: true });

  for (const p of parsowane) {
    fs.copyFileSync(p.sciezka, path.join(katalogKopii, p.nazwa));
  }

  console.log("");
  console.log(`Kopia zapasowa: ${katalogKopii}`);

  function przywroc() {
    for (const p of parsowane) {
      fs.copyFileSync(path.join(katalogKopii, p.nazwa), p.sciezka);
    }

    if (fs.existsSync(sciezkaBazy)) fs.unlinkSync(sciezkaBazy);
  }

  try {
    // ================================================
    // ZAPIS PLIKU WSPÓLNEGO
    // ================================================

    const naglowek = [
      "# Wartości wspólne dla wszystkich serwerów Discorda.",
      "#",
      "# Wygenerowane przez scripts/rozdzielConfigi.js.",
      "# Plik gildii nadpisuje dowolny klucz stąd.",
      "",
    ].join("\n");

    fs.writeFileSync(
      sciezkaBazy,
      naglowek +
        doPrzeniesienia.map(({ klucz, wartosc }) => `${klucz}=${wartosc}`).join("\n") +
        "\n",
      "utf8",
    );

    // ================================================
    // USUNIĘCIE PRZENIESIONYCH KLUCZY
    // ================================================
    //
    // Przepisujemy plik linia po linii, żeby zachować komentarze,
    // puste linie i kolejność pozostałych kluczy.

    for (const p of parsowane) {
      const linie = fs.readFileSync(p.sciezka, "utf8").split(/\r?\n/);

      const zostawione = linie.filter((linia) => {
        const dopasowanie = linia.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);

        if (!dopasowanie) return true;

        return !kluczeDoUsuniecia.has(dopasowanie[1]);
      });

      fs.writeFileSync(p.sciezka, zostawione.join("\n"), "utf8");
    }

    // ================================================
    // SPRAWDZENIE
    // ================================================

    const po = wczytajRegistry();

    const gildie = new Set([...Object.keys(przed), ...Object.keys(po)]);
    const roznice = [];

    for (const g of gildie) {
      if (przed[g] !== po[g]) {
        roznice.push(
          `guild ${g}: ${przed[g] || "(brak przed)"} -> ${po[g] || "(brak po)"}`,
        );
      }
    }

    if (roznice.length) {
      przywroc();

      console.error("");
      console.error("Konfiguracja po rozdzieleniu NIE jest identyczna:");
      roznice.forEach((r) => console.error(`  ${r}`));
      console.error("");
      console.error("Pliki przywrócone z kopii. Nic nie zostało zmienione.");
      process.exit(1);
    }

    console.log("");
    console.log(
      `Gotowe. Efektywna konfiguracja ${gildie.size} serwerów bez zmian ` +
        `(porównane odciski wszystkich kluczy).`,
    );
    console.log(`Kopię możesz usunąć: ${katalogKopii}`);
  } catch (err) {
    przywroc();

    console.error("");
    console.error(`Błąd: ${err.message}`);
    console.error("Pliki przywrócone z kopii.");
    process.exit(1);
  }
}

main();
