// Skąd API bierze konfigurację.
//
// `dotenv.config()` bez ścieżki czyta `.env` z KATALOGU ROBOCZEGO procesu,
// a nie z katalogu modułu. Ten sam `server/app.js` startuje na dwa sposoby
// i każdy ma inny katalog roboczy:
//
//   PM2    -> server/index.js, cwd /home/container/server -> server/.env
//   Plesk  -> web-server.js,   cwd katalog główny repo     -> .env w korzeniu
//
// Czyli ta sama zmienna wpisana do `server/.env` działała pod PM2 i nie
// działała pod Pleskiem, bez żadnego sygnału - po prostu miała wartość
// `undefined`. Kosztowało to rundę diagnostyki przy `WEB_ORIGIN_SUFFIX`.
//
// Tutaj ścieżki są liczone WZGLĘDEM MODUŁU, więc oba wejścia widzą to samo.
//
// Kolejność pierwszeństwa, od najmocniejszego:
//
//   1. `process.env` ustawione przez środowisko (panel Node.js w Plesku,
//      `env` w ecosystem.config.js, zmienna z powłoki),
//   2. `server/.env`  - konfiguracja API,
//   3. `.env` w korzeniu - plik bota; API sięga po niego tylko po to, czego
//      nie znalazło wyżej (w praktyce dostęp do bazy, bo nazwy są wspólne).
//
// Trzyma się to samo dzięki temu, że dotenv DOMYŚLNIE NIE NADPISUJE tego, co
// już jest w `process.env` - ani zmiennych ze środowiska, ani wczytanych
// z wcześniejszego pliku. Dlatego `override` zostaje wyłączone; włączenie go
// odwróciłoby tę kolejność i plik bota wygrywałby z panelem hostingu.

import path from "path";

// Osobno od wczytywania, żeby dało się sprawdzić samą kolejność bez ruszania
// `process.env` w teście.
export function envFiles(serverDir) {
  return [
    path.join(serverDir, ".env"),
    path.join(serverDir, "..", ".env"),
  ];
}

// `dotenvModule` jest wstrzykiwane, żeby test mógł podstawić atrapę i sprawdzić
// kolejność wywołań bez czytania prawdziwych plików.
export function loadEnvironment(serverDir, dotenvModule) {
  const files = envFiles(serverDir);

  for (const file of files) {
    dotenvModule.config({ path: file });
  }

  return files;
}
