// Wyniki meczow i propozycje wynikow z zewnetrznych zrodel.
//
// Propozycja nie wpisuje wyniku sama - trafia do kolejki, a dopiero
// zatwierdzenie przez admina zapisuje go i przelicza punkty. Odrzucenie
// zostawia slad, zeby to samo zrodlo nie wracalo z ta sama propozycja.

export function registerResultProposalRoutes(
  app,
  {
    applyMatchResult,
    getResultProvider,
    guildIdFromEventSlug,
    guildIdFromMatchId,
    guildIdFromProposalId,
    io,
    logError,
    logInfo,
    logWarn,
    matchesStore,
    pool,
    requireGuildAdmin,
    resultProposalsStore,
  },
) {
  app.post(
    "/api/matches/:matchId/result",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { guildId } = req;
        const resA = Number(req.body.resA);
        const resB = Number(req.body.resB);

        if (
          !Number.isInteger(resA) ||
          !Number.isInteger(resB) ||
          resA < 0 ||
          resB < 0
        ) {
          return res.status(400).json({
            error: "Wyniki muszą być nieujemnymi liczbami całkowitymi.",
          });
        }

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
          return res.status(404).json({ error: "Nie znaleziono meczu." });
        }

        await applyMatchResult(pool, { guildId, match, resA, resB });

        const [[eventRow]] = await pool.query(
          "SELECT slug FROM events WHERE id = ? LIMIT 1",
          [match.event_id],
        );

        if (eventRow?.slug) {
          io.emit("dashboard:refresh", { slug: eventRow.slug });
        }

        res.json({ ok: true, matchId: Number(matchId), resA, resB });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  // ============================================================
  // Propozycje wyników z zewnętrznego dostawcy
  //
  // Wynik NIGDY nie zapisuje się sam: synchronizacja tylko odkłada propozycje
  // do kolejki, a dopiero zatwierdzenie przez admina wpisuje wynik i przelicza
  // punkty. Automat piszący wprost do match_results rozjechałby ranking przy
  // pierwszej błędnej albo częściowej odpowiedzi API - bez śladu w interfejsie.
  // ============================================================

  app.post(
    "/api/events/:slug/result-proposals/sync",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { guildId } = req;

        const provider = getResultProvider();

        if (!provider) {
          return res.status(400).json({
            error:
              "Dostawca wyników nie jest skonfigurowany (RESULT_PROVIDER w server/.env)",
          });
        }

        const [[event]] = await pool.query(
          "SELECT id, slug, external_tournament_id FROM events WHERE slug = ? AND guild_id = ? LIMIT 1",
          [req.params.slug, guildId],
        );

        if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

        const podsumowanie = await resultProposalsStore.syncProposals(pool, {
          guildId,
          event,
          provider,
        });

        logInfo("results", "Result proposals synced", {
          guildId,
          slug: event.slug,
          ...podsumowanie,
          by: req.session?.user?.id,
        });

        res.json({
          ok: true,
          summary: podsumowanie,
          proposals: await resultProposalsStore.listProposals(
            pool,
            guildId,
            event.id,
          ),
        });
      } catch (err) {
        console.error(err);

        if (err.code === "NO_EXTERNAL_TOURNAMENT") {
          return res.status(400).json({ error: err.message });
        }

        logError("results", "Result proposal sync failed", {
          guildId: req.guildId,
          slug: req.params.slug,
          message: err?.message,
        });

        res
          .status(502)
          .json({ error: `Nie udało się pobrać wyników: ${err.message}` });
      }
    },
  );

  app.get(
    "/api/events/:slug/result-proposals",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id, external_tournament_id FROM events WHERE slug = ? AND guild_id = ? LIMIT 1",
          [req.params.slug, guildId],
        );

        if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

        res.json({
          proposals: await resultProposalsStore.listProposals(
            pool,
            guildId,
            event.id,
          ),
          externalTournamentId: event.external_tournament_id,
          providerConfigured: !!getResultProvider(),
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  app.post(
    "/api/result-proposals/:proposalId/accept",
    requireGuildAdmin(guildIdFromProposalId),
    async (req, res) => {
      try {
        const { guildId } = req;
        const proposal = await resultProposalsStore.getProposal(
          pool,
          guildId,
          req.params.proposalId,
        );

        if (!proposal)
          return res.status(404).json({ error: "Propozycja nie istnieje" });

        if (proposal.status !== "PENDING") {
          return res
            .status(409)
            .json({ error: `Propozycja jest już ${proposal.status}` });
        }

        const match = await matchesStore.getMatchById(
          pool,
          guildId,
          proposal.match_id,
        );
        if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

        // Ta sama ścieżka, którą idzie ręczne wpisanie wyniku - jeden zapis,
        // jedno przeliczenie punktów, żeby obie drogi nie mogły się rozjechać.
        await applyMatchResult(pool, {
          guildId,
          match,
          resA: proposal.res_a,
          resB: proposal.res_b,
        });

        await resultProposalsStore.markResolved(
          pool,
          guildId,
          proposal.id,
          "ACCEPTED",
          req.session?.user?.id,
        );

        logWarn("results", "Result proposal accepted", {
          guildId,
          matchId: match.id,
          resA: proposal.res_a,
          resB: proposal.res_b,
          source: proposal.source,
          by: req.session?.user?.id,
        });

        const [[eventRow]] = await pool.query(
          "SELECT slug FROM events WHERE id = ? LIMIT 1",
          [match.event_id],
        );

        if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

        res.json({
          ok: true,
          matchId: match.id,
          resA: proposal.res_a,
          resB: proposal.res_b,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  app.post(
    "/api/result-proposals/:proposalId/reject",
    requireGuildAdmin(guildIdFromProposalId),
    async (req, res) => {
      try {
        const { guildId } = req;
        const proposal = await resultProposalsStore.getProposal(
          pool,
          guildId,
          req.params.proposalId,
        );

        if (!proposal)
          return res.status(404).json({ error: "Propozycja nie istnieje" });

        await resultProposalsStore.markResolved(
          pool,
          guildId,
          proposal.id,
          "REJECTED",
          req.session?.user?.id,
        );

        logInfo("results", "Result proposal rejected", {
          guildId,
          matchId: proposal.match_id,
          by: req.session?.user?.id,
        });

        res.json({ ok: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  // Powiązanie eventu z turniejem u dostawcy oraz drużyny z jej nazwą u
  // dostawcy. Bez tego nie da się dopasować niczego automatycznie.
  app.patch(
    "/api/events/:slug/external-link",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { guildId } = req;
        const wartosc =
          String(req.body?.externalTournamentId ?? "").trim() || null;

        const [result] = await pool.query(
          "UPDATE events SET external_tournament_id = ? WHERE slug = ? AND guild_id = ?",
          [wartosc, req.params.slug, guildId],
        );

        if (!result.affectedRows)
          return res.status(404).json({ error: "Nie znaleziono turnieju." });

        res.json({ ok: true, externalTournamentId: wartosc });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );
}
