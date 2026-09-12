// Punkt wejscia API dla hostingu Plesk (rozszerzenie Node.js).
//
// To jest DRUGI sposob uruchomienia tego samego server/app.js - obok
// server/index.js, ktory odpala PM2 jako "pickembot-server". Plesk startuje
// wlasny proces i PM2 o nim nie wie, wiec `pm2 restart pickembot-server`
// konczy sie sukcesem i nie zmienia niczego: strona dalej dostaje stary kod.
// Restart tego procesu robi sie w Plesku (Restart App) albo przez
// `touch tmp/restart.txt`.
//
// Celowo nie ma go w ecosystem.config.js - dopisanie go tam kazaloby PM2
// uruchomic DRUGI serwer na tym samym porcie.

(async () => {
  try {
    const { httpServer } = await import("./server/app.js");

    const PORT = Number(process.env.PORT || 3301);

    httpServer.listen(PORT, () => {
      console.log(`[WEB] API server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("[WEB] Failed to start API:", error);
    process.exit(1);
  }
})();