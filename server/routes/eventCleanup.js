// Zamykanie turnieju i czyszczenie faz.
//
// Cztery trasy: zakonczenie turnieju, eksport klasyfikacji oraz podglad i
// wykonanie czyszczenia pojedynczej fazy. Podglad istnieje po to, zeby admin
// zobaczyl liczby, zanim cokolwiek potwierdzi.

export function registerEventCleanupRoutes(
  app,
  {
    exportClassification,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    logError,
    logWarn,
    path,
    pool,
    requireGuildAdmin,
    runInTransaction,
    safeFileBase,
  },
) {
  app.post(
    "/api/events/:slug/end-tournament",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { archiveName, cleanup = false } = req.body || {};
        const guildId = req.guildId;

        const [[event]] = await pool.query(
          "SELECT id, guild_id, name, slug FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        guildRegistry.ensureGuildDirs(guildId);

        const { archiveDir } = guildRegistry.getGuildPaths(guildId);
        const base = safeFileBase(
          archiveName || event.slug || event.name,
          "pickem_archive",
        );
        const filename = `${base}.xlsx`;
        const filePath = path.join(archiveDir, filename);

        await exportClassification({ guildId, outputPath: filePath });

        await pool.query(
          `INSERT INTO archive_files (guild_id, filename, path) VALUES (?, ?, ?)`,
          [guildId, filename, filePath],
        );

        await pool.query(
          `UPDATE active_panels SET closed = 1, closed_at = NOW(), active = 0 WHERE guild_id = ? AND closed = 0`,
          [guildId],
        );

        if (cleanup) {
          await runInTransaction(pool, async (conn) => {
            await conn.query(`DELETE FROM active_panels WHERE guild_id = ?`, [
              guildId,
            ]);
            await conn.query(
              `DELETE FROM swiss_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playoffs_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM doubleelim_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playin_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM swiss_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playoffs_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM doubleelim_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playin_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM match_points WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM match_map_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM match_map_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM match_predictions WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM match_results WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM matches WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM swiss_scores WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playoffs_scores WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM doubleelim_scores WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
            await conn.query(
              `DELETE FROM playin_scores WHERE guild_id = ? AND event_id = ?`,
              [guildId, event.id],
            );
          });
        }

        await pool.query(
          `UPDATE events SET status = 'FINISHED', is_archived = 1, is_open = 0, is_active = 0, phase = 'FINISHED' WHERE id = ? LIMIT 1`,
          [event.id],
        );

        logWarn("tournament", "Tournament ended from web panel", {
          guildId,
          eventId: event.id,
          slug,
          filename,
          cleanup: Boolean(cleanup),
          by: req.session?.user?.id,
        });

        io.emit("dashboard:refresh", { slug });
        io.emit("event:status_updated", { slug, status: "FINISHED" });

        res.json({
          ok: true,
          archive: { filename, path: filePath },
          cleanup: Boolean(cleanup),
        });
      } catch (err) {
        console.error(err);

        logError("tournament", "Web end tournament failed", {
          slug: req.params.slug,
          guildId: req.guildId,
          message: err?.message,
          stack: err?.stack,
        });

        res.status(500).json({ error: "End tournament failed" });
      }
    },
  );

  app.get(
    "/api/events/:slug/export/classification",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const buffer = await exportClassification({ guildId, eventId: event.id });

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="klasyfikacja-${slug}.xlsx"`,
        );
        res.send(buffer);
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Failed to generate classification export",
        });
      }
    },
  );

  app.get(
    "/api/events/:slug/phases/:phase/clear-preview",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug, phase } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const [[points]] = await pool.query(
          `
              SELECT COUNT(*) AS count
              FROM match_points mp
              JOIN matches m ON m.id = mp.match_id
              WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
              `,
          [phase, guildId, event.id],
        );

        const [[predictions]] = await pool.query(
          `
              SELECT COUNT(*) AS count
              FROM match_predictions pr
              JOIN matches m ON m.id = pr.match_id
              WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
              `,
          [phase, guildId, event.id],
        );

        const [[results]] = await pool.query(
          `
              SELECT COUNT(*) AS count
              FROM match_results mr
              JOIN matches m ON m.id = mr.match_id
              WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
              `,
          [phase, guildId, event.id],
        );

        const [[matches]] = await pool.query(
          `
              SELECT COUNT(*) AS count
              FROM matches
              WHERE phase = ? AND guild_id = ? AND event_id = ?
              `,
          [phase, guildId, event.id],
        );

        res.json({
          matches: matches.count,
          predictions: predictions.count,
          results: results.count,
          points: points.count,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/phases/:phase/clear",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug, phase } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const { r1, r2, r3, r4 } = await runInTransaction(pool, async (conn) => {
          const [r1] = await conn.query(
            `
                  DELETE mp
                  FROM match_points mp
                  JOIN matches m ON m.id = mp.match_id
                  WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          const [r2] = await conn.query(
            `
                  DELETE pr
                  FROM match_predictions pr
                  JOIN matches m ON m.id = pr.match_id
                  WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          const [r3] = await conn.query(
            `
                  DELETE mr
                  FROM match_results mr
                  JOIN matches m ON m.id = mr.match_id
                  WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          // Tabele per-mapa były tu pominięte, więc czyszczenie fazy
          // zostawiało wiersze wskazujące na skasowane mecze. Na produkcji
          // jest już po tym 2 osieroconych typów map i 3 wyników map.
          await conn.query(
            `
                  DELETE mmp
                  FROM match_map_predictions mmp
                  JOIN matches m ON m.id = mmp.match_id
                  WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          await conn.query(
            `
                  DELETE mmr
                  FROM match_map_results mmr
                  JOIN matches m ON m.id = mmr.match_id
                  WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          const [r4] = await conn.query(
            `
                  DELETE FROM matches
                  WHERE phase = ? AND guild_id = ? AND event_id = ?
                  `,
            [phase, guildId, event.id],
          );

          return { r1, r2, r3, r4 };
        });

        logWarn("matches", "Cleared matches phase via web panel", {
          guildId,
          eventId: event.id,
          phase,
          deleted_points: r1?.affectedRows ?? 0,
          deleted_predictions: r2?.affectedRows ?? 0,
          deleted_results: r3?.affectedRows ?? 0,
          deleted_matches: r4?.affectedRows ?? 0,
          by: req.session?.user?.id,
        });

        io.emit("dashboard:refresh", { slug });

        res.json({
          ok: true,
          deleted: {
            matches: r4?.affectedRows ?? 0,
            predictions: r2?.affectedRows ?? 0,
            results: r3?.affectedRows ?? 0,
            points: r1?.affectedRows ?? 0,
          },
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );
}
