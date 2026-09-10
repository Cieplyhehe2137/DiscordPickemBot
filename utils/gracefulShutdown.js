// utils/gracefulShutdown.js
//
// Oba procesy - bot i serwer WWW - chodzą pod PM2. Przy `pm2 restart` PM2
// wysyła SIGINT, czeka kill_timeout i dopiero wtedy dobija SIGKILL-em. Bez
// obsługi sygnału proces ginie w pół kroku: MySQL nie dostaje COM_QUIT i
// zostaje z połączeniami, które dopiero po timeoucie uzna za martwe, klient
// Discorda nie żegna się z gatewayem, a timery potrafią jeszcze strzelić
// zapytaniem do puli, której już nie ma.
//
// Moduł jest CommonJS, bo woła go zarówno bot (CJS), jak i serwer (ESM przez
// createRequire) - tak samo jak resztę wspólnych rzeczy z utils/.

const SYGNALY = ["SIGINT", "SIGTERM"];

// Zapas względem kill_timeout PM2 (10s w ecosystem.config.js). Chcemy wyjść
// sami, zanim PM2 straci cierpliwość - inaczej cała ta robota idzie w kosz.
const LIMIT_MS = 8000;

// kroki: [{ opis, zrob }] - wykonywane po kolei, bo kolejność ma znaczenie.
// Najpierw odcinamy dopływ nowej pracy, dopiero na końcu zamykamy bazę.
function zarejestrujZamykanie({ nazwa, kroki, limitMs = LIMIT_MS, log }) {
  // Bot w produkcji podmienia console.log na pustą funkcję (index.js), więc
  // domyślnie logujemy przez console.warn - inaczej te komunikaty znikałyby
  // dokładnie wtedy, kiedy są potrzebne.
  const zapisz = log || console.warn.bind(console);

  let trwa = false;

  async function zamknij(sygnal) {
    if (trwa) {
      // Drugi sygnał znaczy "nie czekam": ktoś wcisnął Ctrl+C dwa razy albo
      // PM2 ponawia. Wychodzimy od razu, zamiast dokładać kolejny przebieg.
      zapisz(`[SHUTDOWN] ${nazwa}: ${sygnal} po raz drugi - wychodzę od razu`);
      process.exit(1);
    }

    trwa = true;
    zapisz(`[SHUTDOWN] ${nazwa}: ${sygnal} - zamykam`);

    // Bezpiecznik na wypadek, gdyby któryś krok nigdy nie oddał sterowania.
    // unref, żeby sam z siebie nie trzymał procesu przy życiu.
    const bezpiecznik = setTimeout(() => {
      zapisz(`[SHUTDOWN] ${nazwa}: przekroczone ${limitMs}ms - wychodzę siłą`);
      process.exit(1);
    }, limitMs);

    bezpiecznik.unref();

    for (const krok of kroki) {
      try {
        await krok.zrob();
        zapisz(`[SHUTDOWN] ${nazwa}: ${krok.opis} - ok`);
      } catch (err) {
        // Jeden nieudany krok nie może zablokować reszty. Pula ma się zamknąć
        // nawet wtedy, gdy Discord albo socket.io nie odpowiada.
        zapisz(
          `[SHUTDOWN] ${nazwa}: ${krok.opis} - błąd: ${err?.message || err}`,
        );
      }
    }

    clearTimeout(bezpiecznik);
    zapisz(`[SHUTDOWN] ${nazwa}: gotowe`);
    process.exit(0);
  }

  for (const sygnal of SYGNALY) {
    process.on(sygnal, () => {
      zamknij(sygnal);
    });
  }
}

// Owija API na callbackach (http.Server, dgram.Socket) w obietnicę, żeby
// kroki dało się po prostu awaitować.
function zamknijZCallbackiem(obiekt) {
  return new Promise((resolve, reject) => {
    obiekt.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  zarejestrujZamykanie,
  zamknijZCallbackiem,
};
