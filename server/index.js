// server/index.js
//
// Punkt wejscia procesu. Buduje aplikacje app.js, a potem ja uruchamia:
// nasluchiwanie HTTP, odbiornik logow CS2 i obsluga sygnalow.
//
// Ten podzial nie jest kosmetyczny. Dopoki wszystko siedzialo w jednym pliku,
// samo zaimportowanie serwera zajmowalo port 3301 i 27500 - czyli nie dalo sie
// go zaladowac w tescie. Teraz app.js mozna zaimportowac bez skutkow ubocznych,
// dzieki czemu tablice tras da sie sprawdzic automatycznie przy dalszym
// rozbijaniu tego pliku.

import { createRequire } from "module";

import { io, httpServer, sessionStore } from "./app.js";
import { pool } from "./db.js";
import { startCs2LogReceiver } from "./live/cs2LogReceiver.js";
import { parseCs2LogLine } from "./live/cs2LogParser.js";

const require = createRequire(import.meta.url);

const {
  zarejestrujZamykanie,
  zamknijZCallbackiem,
} = require("../utils/gracefulShutdown");

const PORT = Number(process.env.PORT || 3301);

httpServer.listen(PORT, () => {
  console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});

const cs2Receiver = startCs2LogReceiver({
  port: Number(process.env.CS2_LOG_PORT || 27500),
  onLine(raw) {
    const parsed = parseCs2LogLine(raw);

    if (!parsed) return;

    console.log("[CS2 PARSED]", parsed);
  },
});

zarejestrujZamykanie({
  nazwa: "serwer",
  kroki: [
    {
      // Najpierw odcinamy dopływ: rozłączamy klientów socket.io i przestajemy
      // przyjmować nowe żądania HTTP.
      opis: "rozłączenie klientów socket.io",
      zrob() {
        return new Promise((resolve) => {
          io.close(() => resolve());
        });
      },
    },
    {
      opis: "zamknięcie serwera HTTP",
      async zrob() {
        // io.close() zamyka też serwer HTTP pod spodem, więc domykamy go tylko
        // wtedy, gdy z jakiegoś powodu nadal nasłuchuje.
        if (!httpServer.listening) return;

        await zamknijZCallbackiem(httpServer);
      },
    },
    {
      opis: "zamknięcie odbiornika logów CS2",
      async zrob() {
        await zamknijZCallbackiem(cs2Receiver);
      },
    },
    {
      // Store dostał gotową pulę, więc jego close() tylko kasuje interwał
      // czyszczenia wygasłych sesji - puli nie rusza (endConnectionOnClose
      // jest wtedy false). Pulę zamykamy sami, krok niżej.
      opis: "zatrzymanie czyszczenia sesji",
      async zrob() {
        await sessionStore.close();
      },
    },
    {
      opis: "zamknięcie puli MySQL",
      async zrob() {
        await pool.end();
      },
    },
  ],
});
