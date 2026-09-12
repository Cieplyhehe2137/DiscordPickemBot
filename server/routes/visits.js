import {
  dayKey,
  isBot,
  resolveSecret,
  visitorHash,
} from "../lib/visitorHash.js";

// Licznik odwiedzin.
//
// Dwie trasy: jedna zapisuje wejście, druga oddaje liczby do wyświetlenia.
// Obie są publiczne i obie muszą być tanie - zapis idzie przy KAŻDYM wejściu
// na stronę główną.
//
// Sól procesu liczona raz, nie przy każdym zapytaniu: bez ustawionej zmiennej
// VISIT_SALT jest losowana, a losowanie jej za każdym razem znaczyłoby, że
// każde odświeżenie to nowy odwiedzający.

export function registerVisitRoutes(app, { pool, env = process.env } = {}) {
  const secret = resolveSecret(env);

  app.post("/api/public/visit", async (req, res) => {
    // Odpowiadamy 204 zawsze i natychmiast, także automatom i przy błędzie
    // bazy. Licznik odwiedzin nie jest powodem, żeby cokolwiek na stronie
    // przestało działać albo żeby ktoś czekał na odpowiedź.
    try {
      const userAgent = req.get("user-agent");

      if (isBot(userAgent)) {
        return res.status(204).end();
      }

      const day = dayKey();

      const hash = visitorHash({
        ip: req.ip || "",
        userAgent,
        day,
        secret,
      });

      // INSERT IGNORE, bo klucz główny (day, visitor_hash) sam odrzuca
      // powtórne wejście tego samego dnia. Bez tego trzeba by najpierw
      // sprawdzać SELECT-em, czyli dwa zapytania zamiast jednego i wyścig
      // między nimi przy dwóch kartach otwartych naraz.
      await pool.query(
        "INSERT IGNORE INTO site_visits (day, visitor_hash) VALUES (?, ?)",
        [day, hash],
      );

      return res.status(204).end();
    } catch (err) {
      console.error("VISIT COUNTER ERROR:", err);

      return res.status(204).end();
    }
  });

  app.get("/api/public/visits", async (req, res) => {
    try {
      const day = dayKey();

      const [[razem]] = await pool.query(
        "SELECT COUNT(*) AS n FROM site_visits",
      );

      const [[dzis]] = await pool.query(
        "SELECT COUNT(*) AS n FROM site_visits WHERE day = ?",
        [day],
      );

      return res.json({
        total: Number(razem?.n ?? 0),
        today: Number(dzis?.n ?? 0),
      });
    } catch (err) {
      console.error("VISIT STATS ERROR:", err);

      return res.status(503).json({
        error: "Nie udało się pobrać licznika odwiedzin.",
      });
    }
  });
}
