// Czy proces naprawde dziala.
//
// PM2 widzi tylko, ze proces zyje. Nie widzi, ze baza odpadla, a wtedy serwer
// nadal odpowiada 200 na wszystko, co nie dotyka MySQL-a, i wyglada zdrowo -
// awaria wychodzi dopiero z reklamacji gracza.
//
// Zapytanie jest najtansze z mozliwych (SELECT 1) i idzie przez te sama pule,
// z ktorej korzysta reszta API: chodzi o to, zeby sprawdzic pule, ktora
// faktycznie obsluguje ruch, a nie otwierac nowe polaczenie, ktore moze sie
// udac nawet wtedy, gdy pula jest wyczerpana.
//
// 503 zamiast 200 z trescia bledu, bo tylko na kod odpowiedzi patrza
// automaty: PM2, uptime monitor czy load balancer.

export function registerHealthRoutes(app, { pool }) {
  app.get("/api/health", async (req, res) => {
    const zaczeto = Date.now();

    try {
      await pool.query("SELECT 1");

      return res.json({
        status: "ok",
        db: "ok",
        dbLatencyMs: Date.now() - zaczeto,
        uptimeSec: Math.round(process.uptime()),
      });
    } catch (err) {
      // Komunikat bledu bazy nie idzie do odpowiedzi - potrafi zawierac host,
      // uzytkownika i nazwe bazy, a ten endpoint jest publiczny.
      console.error("HEALTH DB ERROR:", err);

      return res.status(503).json({
        status: "degraded",
        db: "error",
        dbLatencyMs: Date.now() - zaczeto,
        uptimeSec: Math.round(process.uptime()),
      });
    }
  });
}
