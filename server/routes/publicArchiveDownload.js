// Pobranie pliku archiwum turnieju: GET /api/public/archives/:id/download.
//
// Z typowaniem nie ma to nic wspolnego, a mimo to lezalo w srodku serii
// tras typowania. Naglowek publicPickem.js tlumaczyl dlaczego: trasy
// rejestruja sie po kolei i przeniesienie tej jednej gdziekolwiek dalej
// przestawialoby kolejnosc, czyli zmienialo zachowanie.
//
// Po podziale jedno i drugie da sie miec naraz: plik jest osobny, a
// wywolanie zostaje dokladnie na swoim miejscu w kolejnosci.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerPublicArchiveDownloadRoutes(app, { fs, path, pool }) {
  app.get("/api/public/archives/:id/download", async (req, res) => {
    try {
      const { id } = req.params;

      const [[archive]] = await pool.query(
        `
              SELECT *
              FROM archive_files
              WHERE id = ?
              LIMIT 1
              `,
        [id],
      );

      if (!archive) {
        return res.status(404).json({
          error: "Archive not found",
        });
      }

      const dbPath = archive.path;

      const rebuiltPath = path.join(
        process.cwd(),
        "archiwum",
        String(archive.guild_id),
        archive.filename,
      );

      const finalPath = fs.existsSync(dbPath) ? dbPath : rebuiltPath;

      if (!fs.existsSync(finalPath)) {
        return res.status(404).json({
          error: "Archive file missing",
        });
      }

      return res.download(finalPath, archive.filename);
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: "Download failed",
      });
    }
  });
}
