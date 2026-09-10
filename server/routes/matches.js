// Pojedynczy mecz od strony administratora: podglad skutkow usuniecia,
// usuniecie, edycja i blokada typowania.
//
// Cztery trasy /api/matches/:matchId. Rejestracja na `app`, nie przez
// Router, zeby ksztalt tablicy tras sie nie zmienil; zaleznosci argumentem
// pod nazwami z app.js, wiec przeniesiony kod jest niezmieniony poza wcieciem.

export function registerMatchRoutes(
  app,
  {
    getLockBeforeSec,
    guildIdFromMatchId,
    io,
    isMatchStarted,
    logInfo,
    logWarn,
    matchesStore,
    policzDaneMeczu,
    pool,
    recalculateMatchPoints,
    requireGuildAdmin,
    runInTransaction,
  },
) {
  app.get(
    "/api/matches/:matchId/delete-preview",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const match = await matchesStore.getMatchById(
          pool,
          req.guildId,
          req.params.matchId,
        );
        if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

        res.json({
          match: {
            id: match.id,
            phase: match.phase,
            matchNo: match.match_no,
            teamA: match.team_a,
            teamB: match.team_b,
            bestOf: match.best_of,
          },
          usunie: await policzDaneMeczu(match.id),
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  app.delete(
    "/api/matches/:matchId",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { guildId } = req;
        const match = await matchesStore.getMatchById(
          pool,
          guildId,
          req.params.matchId,
        );

        if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

        const usunie = await policzDaneMeczu(match.id);

        // Kolejność jak przy czyszczeniu fazy, ale z tabelami per-mapa, których
        // tamten kod nie obejmował - bez nich zostawałyby wiersze wskazujące
        // na nieistniejący mecz.
        await runInTransaction(pool, async (conn) => {
          for (const tabela of [
            "match_points",
            "match_predictions",
            "match_map_predictions",
            "match_results",
            "match_map_results",
          ]) {
            await conn.query(`DELETE FROM \`${tabela}\` WHERE match_id = ?`, [
              match.id,
            ]);
          }

          await conn.query("DELETE FROM matches WHERE id = ? AND guild_id = ?", [
            match.id,
            guildId,
          ]);
        });

        logWarn("matches", "Match deleted from web panel", {
          guildId,
          matchId: match.id,
          phase: match.phase,
          teams: `${match.team_a} vs ${match.team_b}`,
          usunie,
          by: req.session?.user?.id,
        });

        const [[eventRow]] = await pool.query(
          "SELECT slug FROM events WHERE id = ? LIMIT 1",
          [match.event_id],
        );

        if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

        res.json({ ok: true, usunieto: usunie });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Nie udało się usunąć meczu." });
      }
    },
  );

  app.patch(
    "/api/matches/:matchId",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { guildId } = req;
        const { teamA, teamB, bestOf, startTimeUtc } = req.body || {};

        const match = await matchesStore.getMatchById(
          pool,
          guildId,
          req.params.matchId,
        );
        if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

        const noweA = teamA ?? match.team_a;
        const noweB = teamB ?? match.team_b;
        const noweBo = bestOf === undefined ? match.best_of : Number(bestOf);

        if (noweA === noweB) {
          return res.status(400).json({ error: "Drużyny muszą być różne." });
        }

        if (![1, 3, 5].includes(Number(noweBo))) {
          return res.status(400).json({ error: "BO musi wynosić 1, 3 albo 5." });
        }

        // Ta sama walidacja co przy tworzeniu - matches.team_a to varchar, więc
        // literówka wjechałaby do bazy i rozjechała dopasowywanie wyników.
        if (teamA !== undefined || teamB !== undefined) {
          const [aktywne] = await pool.query(
            "SELECT name FROM teams WHERE guild_id = ? AND active = 1 AND name IN (?, ?)",
            [guildId, noweA, noweB],
          );

          const znane = new Set(aktywne.map((t) => t.name));

          if (!znane.has(noweA) || !znane.has(noweB)) {
            return res.status(400).json({
              error: "Obie drużyny muszą istnieć i być aktywne na tym serwerze.",
            });
          }
        }

        await pool.query(
          `UPDATE matches
                  SET team_a = ?, team_b = ?, best_of = ?, start_time_utc = ?
                WHERE id = ? AND guild_id = ?`,
          [
            noweA,
            noweB,
            noweBo,
            startTimeUtc === undefined
              ? match.start_time_utc
              : startTimeUtc || null,
            match.id,
            guildId,
          ],
        );

        // Zmiana drużyn albo BO unieważnia dotychczasowe punkty tego meczu -
        // typy graczy zostają, ale liczą się teraz względem czego innego.
        // Przeliczamy od razu, żeby ranking nie został z punktami policzonymi
        // dla poprzedniego układu.
        const zmianaWplywajacaNaPunkty =
          noweA !== match.team_a ||
          noweB !== match.team_b ||
          Number(noweBo) !== Number(match.best_of);

        if (zmianaWplywajacaNaPunkty) {
          await recalculateMatchPoints(
            pool,
            guildId,
            match.event_id,
            match.id,
            noweBo,
          );
        }

        logInfo("matches", "Match edited from web panel", {
          guildId,
          matchId: match.id,
          przed: `${match.team_a} vs ${match.team_b} BO${match.best_of}`,
          po: `${noweA} vs ${noweB} BO${noweBo}`,
          przeliczono: zmianaWplywajacaNaPunkty,
          by: req.session?.user?.id,
        });

        const [[eventRow]] = await pool.query(
          "SELECT slug FROM events WHERE id = ? LIMIT 1",
          [match.event_id],
        );

        if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

        res.json({
          ok: true,
          match: await matchesStore.getMatchById(pool, guildId, match.id),
          przeliczonoPunkty: zmianaWplywajacaNaPunkty,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Nie udało się zapisać zmian w meczu." });
      }
    },
  );

  app.post(
    "/api/matches/:matchId/lock",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { mode } = req.body;

        if (!["auto", "lock", "unlock"].includes(mode)) {
          return res.status(400).json({
            error: "Nieprawidłowy tryb blokady.",
          });
        }

        const [[currentMatch]] = await pool.query(
          `
          SELECT
            id,
            start_time_utc,
            is_locked
          FROM matches
          WHERE id = ?
          LIMIT 1
          `,
          [matchId],
        );

        if (!currentMatch) {
          return res.status(404).json({
            error: "Nie znaleziono meczu.",
          });
        }

        let override = null;
        let isLocked = Number(currentMatch.is_locked) === 1;

        if (mode === "lock") {
          override = 1;
        }

        if (mode === "unlock") {
          override = 0;
        }

        if (mode === "auto") {
          override = null;

          isLocked = isMatchStarted(
            {
              start_time_utc: currentMatch.start_time_utc,
            },
            undefined,
            getLockBeforeSec(),
          );
        }

        await pool.query(
          `
          UPDATE matches
          SET
            lock_override = ?,
            is_locked = ?
          WHERE id = ?
          LIMIT 1
          `,
          [override, isLocked ? 1 : 0, matchId],
        );

        const [[match]] = await pool.query(
          `
          SELECT e.slug
          FROM matches m
          JOIN events e
            ON e.id = m.event_id
          WHERE m.id = ?
          LIMIT 1
          `,
          [matchId],
        );

        if (match?.slug) {
          io.emit("match:updated", {
            slug: match.slug,
            matchId,
            mode,
          });

          io.emit("dashboard:refresh", {
            slug: match.slug,
          });
        }

        res.json({
          ok: true,
          matchId,
          mode,
          lockOverride: override,
          isLocked,
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
