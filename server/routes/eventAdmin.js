// Cykl zycia eventu po stronie administratora: archiwum turnieju, MVP,
// uruchomienie typowania i zmiana fazy.
//
// Szesc tras. "Uruchom typowanie" tylko zleca robote botowi przez auto_start_*
// - panel na Discordzie publikuje bot, bo to on ma klienta Discorda; API go nie
// ma i miec nie moze.
//
// Jak w pozostalych modulach tras: rejestracja na `app`, nie przez Router, zeby
// ksztalt tablicy tras sie nie zmienil, i zaleznosci argumentem pod nazwami
// z app.js - przeniesiony kod jest niezmieniony poza wcieciem.

// Czy wolno skasowac kandydata MVP.
//
// Jedno miejsce, bo pytaja o to dwie trasy: kasowanie pojedyncze i hurtowe.
// Dwie kopie tej reguly rozjechalyby sie przy pierwszej zmianie, a rozjazd
// oznaczalby, ze hurtem da sie usunac cos, czego pojedynczo nie wolno.
//
// Odmowa nie jest ostroznoscia na wyrost: mvp_predictions.candidate_id NIE ma
// klucza obcego do mvp_candidates, wiec baza puscilaby takie kasowanie, a typ
// gracza zostalby golym numerem (handlers/admin/exportClassification.js pisze
// wtedy "ID 42").
//
// Zwraca { candidate } albo { blad } z gotowym komunikatem.
async function sprawdzKandydataDoUsuniecia(pool, guildId, eventId, candidateId) {
  // Kandydat musi nalezec do TEGO turnieju - inaczej wystarczyloby znac id,
  // zeby skasowac kandydata z cudzego eventu na wlasnym serwerze.
  const [[candidate]] = await pool.query(
    `
    SELECT id, nickname
    FROM mvp_candidates
    WHERE id = ?
      AND guild_id = ?
      AND event_id = ?
    LIMIT 1
    `,
    [candidateId, guildId, eventId],
  );

  if (!candidate) {
    return { blad: "Nie znaleziono kandydata.", kod: 404 };
  }

  const [[wynik]] = await pool.query(
    `
    SELECT COUNT(*) AS ile
    FROM mvp_results
    WHERE guild_id = ?
      AND event_id = ?
      AND candidate_id = ?
    `,
    [guildId, eventId, candidateId],
  );

  if (Number(wynik.ile) > 0) {
    return {
      candidate,
      kod: 409,
      blad: `"${candidate.nickname}" jest zapisany jako zwycięzca MVP. Wskaż najpierw innego zwycięzcę.`,
    };
  }

  const [[typy]] = await pool.query(
    `
    SELECT COUNT(*) AS ile
    FROM mvp_predictions
    WHERE guild_id = ?
      AND event_id = ?
      AND candidate_id = ?
    `,
    [guildId, eventId, candidateId],
  );

  if (Number(typy.ile) > 0) {
    return {
      candidate,
      kod: 409,
      blad: `"${candidate.nickname}" został wytypowany przez ${typy.ile} ${
        Number(typy.ile) === 1 ? "gracza" : "graczy"
      } - skasowanie zostawiłoby ich typy bez nazwiska. Możesz go odznaczyć, zapisując listę bez niego.`,
    };
  }

  return { candidate };
}

// Ile kandydatow wolno podac w jednym zadaniu hurtowym. Nie ma tu zadnej
// magii poza tym, ze jeden turniej uzbiera ich najwyzej kilkaset (IEM Cologne:
// 105), a bez gornej granicy kazdy zalogowany admin mialby darmowa petle
// zapytan do bazy.
const LIMIT_HURTOWY = 500;

export function registerEventAdminRoutes(
  app,
  {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    emitDashboardRefresh,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    logInfo,
    pool,
    requireGuildAdmin,
    runInTransaction,
  },
) {
  app.get(
    "/api/events/:slug/archive",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          `SELECT id, guild_id, slug, name, status, is_archived, phase, created_at
               FROM events WHERE guild_id = ? AND slug = ? LIMIT 1`,
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const [base] = await pool.query(
          `SELECT user_id, total_points FROM leaderboard
               WHERE guild_id = ? AND event_id = ?`,
          [guildId, event.id],
        );

        const [detail] = await pool.query(
          `
              SELECT
                  c.user_id,
                  MAX(c.displayname)          AS displayname,
                  SUM(c.swiss_points)         AS swiss_points,
                  SUM(c.playoffs_points)      AS playoffs_points,
                  SUM(c.playin_points)        AS playin_points,
                  SUM(c.doubleelim_points)    AS doubleelim_points,
                  SUM(c.match_points)         AS match_points
              FROM (
                  SELECT user_id, displayname, COALESCE(points,0) AS swiss_points,
                         0 AS playoffs_points, 0 AS playin_points, 0 AS doubleelim_points, 0 AS match_points
                  FROM swiss_scores WHERE guild_id = ? AND event_id = ?
                  UNION ALL
                  SELECT user_id, displayname, 0, COALESCE(points, score, 0), 0, 0, 0
                  FROM playoffs_scores WHERE guild_id = ? AND event_id = ?
                  UNION ALL
                  SELECT user_id, displayname, 0, 0, COALESCE(points,0), 0, 0
                  FROM playin_scores WHERE guild_id = ? AND event_id = ?
                  UNION ALL
                  SELECT user_id, displayname, 0, 0, 0, COALESCE(points,0), 0
                  FROM doubleelim_scores WHERE guild_id = ? AND event_id = ?
                  UNION ALL
                  SELECT user_id, NULL, 0, 0, 0, 0, COALESCE(points,0)
                  FROM match_points WHERE guild_id = ? AND event_id = ?
              ) c
              GROUP BY c.user_id
              `,
          Array(5).fill([guildId, event.id]).flat(),
        );

        const byUser = new Map(detail.map((d) => [d.user_id, d]));

        // Jeśli leaderboard jest pusty (turniej sprzed jego wprowadzenia),
        // opieramy klasyfikację na tym, co zostało w *_scores.
        const source = base.length
          ? base.map((b) => ({ ...b, ...(byUser.get(b.user_id) || {}) }))
          : detail.map((d) => ({
            ...d,
            total_points:
              Number(d.swiss_points || 0) +
              Number(d.playoffs_points || 0) +
              Number(d.playin_points || 0) +
              Number(d.doubleelim_points || 0) +
              Number(d.match_points || 0),
          }));

        const standings = source
          .map((r) => ({
            user_id: r.user_id,
            displayname: r.displayname || null,
            total_points: Number(r.total_points || 0),
            swiss_points: Number(r.swiss_points || 0),
            playoffs_points: Number(r.playoffs_points || 0),
            playin_points: Number(r.playin_points || 0),
            doubleelim_points: Number(r.doubleelim_points || 0),
            match_points: Number(r.match_points || 0),
          }))
          .sort((a, b) => b.total_points - a.total_points)
          .map((r, i) => ({ rank: i + 1, ...r }));

        const [matches] = await pool.query(
          `SELECT m.id, m.match_no, m.phase, m.team_a, m.team_b, m.best_of,
                      r.res_a, r.res_b
               FROM matches m
               LEFT JOIN match_results r ON r.match_id = m.id
               WHERE m.guild_id = ? AND m.event_id = ?
               ORDER BY m.phase, m.match_no`,
          [guildId, event.id],
        );

        const [swiss] = await pool.query(
          `SELECT stage, correct_3_0, correct_0_3, correct_advancing
               FROM swiss_results WHERE guild_id = ? AND event_id = ? AND active = 1
               ORDER BY stage`,
          [guildId, event.id],
        );

        const playoffs = await getCurrentPlayoffs(pool, guildId, event.id);
        const doubleelim = await getCurrentDoubleElimResults(
          pool,
          guildId,
          event.id,
        );
        const playin = await getCurrentPlayinResults(pool, guildId, event.id);

        const [[mvp]] = await pool.query(
          `SELECT c.nickname, c.team_name
               FROM mvp_results r
               JOIN mvp_candidates c ON c.id = r.candidate_id
               WHERE r.guild_id = ? AND r.event_id = ? AND r.active = 1
               LIMIT 1`,
          [guildId, event.id],
        );

        const [files] = await pool.query(
          "SELECT id, filename, created_at FROM archive_files WHERE guild_id = ? ORDER BY id DESC",
          [guildId],
        );

        res.json({
          event,
          standings,
          matches,
          phase_results: { swiss, playoffs, doubleelim, playin },
          mvp: mvp || null,
          archive_file:
            files.find((f) =>
              f.filename.toLowerCase().includes(String(event.slug).toLowerCase()),
            ) || null,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  app.get(
    "/api/events/:slug/mvp",
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
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const [candidates] = await pool.query(
          `
              SELECT id, nickname, team_name, is_active
              FROM mvp_candidates
              WHERE guild_id = ? AND event_id = ?
              ORDER BY is_active DESC, nickname ASC
              `,
          [guildId, event.id],
        );

        const [[result]] = await pool.query(
          `
              SELECT candidate_id
              FROM mvp_results
              WHERE guild_id = ? AND event_id = ? AND active = 1
              LIMIT 1
              `,
          [guildId, event.id],
        );

        res.json({ candidates, result: result || null });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/mvp/candidates",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const { entries } = req.body;

        if (!Array.isArray(entries) || !entries.length) {
          return res.status(400).json({
            error: "entries musi być niepustą tablicą { nickname, teamName }.",
            code: "server.entriesArray",
          });
        }

        const clean = entries
          .map((e) => ({
            nickname: String(e.nickname || "").trim(),
            teamName: e.teamName ? String(e.teamName).trim() : null,
          }))
          .filter((e) => e.nickname);

        if (!clean.length) {
          return res.status(400).json({
            error: "No valid candidates provided",
            code: "server.noValidCandidates",
          });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        await runInTransaction(pool, async (conn) => {
          await conn.query(
            "UPDATE mvp_candidates SET is_active = 0 WHERE guild_id = ? AND event_id = ?",
            [guildId, event.id],
          );

          for (const c of clean) {
            await conn.query(
              `
                      INSERT INTO mvp_candidates (guild_id, event_id, nickname, team_name, is_active)
                      VALUES (?, ?, ?, ?, 1)
                      `,
              [guildId, event.id, c.nickname, c.teamName],
            );
          }
        });

        res.json({ ok: true, count: clean.length });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  // Skasowanie pojedynczego kandydata.
  //
  // Zapis listy (POST .../mvp/candidates) nie kasuje niczego - ustawia starym
  // wpisom is_active = 0 i dopisuje nowe. Historia zostaje, ale lista w panelu
  // pokazuje wszystkich, wiec z kazdym zapisem rosnie i nie da sie z niej
  // usunac literowki ani kandydata wpisanego przez pomylke.
  //
  // Kasujemy TWARDO, ale tylko wtedy, gdy nikt sie do kandydata nie odwoluje.
  // Dokladnie ta sama zasada co przy druzynach (DELETE .../teams/:teamId):
  // 409 i wyjasnienie, co trzyma rekord, zamiast cichego osierocenia wierszy.
  // Powod jest konkretny: mvp_predictions.candidate_id NIE ma klucza obcego
  // do mvp_candidates, wiec baza takiego kasowania by nie zatrzymala, a typ
  // gracza zamienilby sie w goly numer (patrz handlers/admin/
  // exportClassification.js, ktory dla brakujacego kandydata pisze "ID 42").
  app.delete(
    "/api/events/:slug/mvp/candidates/:candidateId",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const candidateId = Number(req.params.candidateId);

        if (!Number.isInteger(candidateId) || candidateId <= 0) {
          return res
            .status(400)
            .json({
              error: "Wymagany jest identyfikator kandydata.",
              code: "server.candidateIdRequired",
            });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const ocena = await sprawdzKandydataDoUsuniecia(
          pool,
          guildId,
          event.id,
          candidateId,
        );

        if (ocena.blad) {
          return res.status(ocena.kod).json({ error: ocena.blad });
        }

        await pool.query(
          `
          DELETE FROM mvp_candidates
          WHERE id = ?
            AND guild_id = ?
            AND event_id = ?
          `,
          [candidateId, guildId, event.id],
        );

        res.json({ ok: true, deletedId: candidateId });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  // Kasowanie hurtowe.
  //
  // POST, nie DELETE z cialem: DELETE z ladunkiem jest dopuszczalny, ale
  // posrednicy potrafia go obciac, a w tym repo operacje zbiorcze i tak stoja
  // pod czasownikiem w sciezce (patrz .../teams/import, .../teams/reorder).
  //
  // Odpowiedz jest ZAWSZE 200, takze gdy czesc wpisow odrzucono. Zadanie na
  // 92 kandydatow, z ktorych 13 ma powiazania, nie jest bledem - jest
  // wynikiem mieszanym, a wolajacy musi wiedziec, co dokladnie zostalo.
  app.post(
    "/api/events/:slug/mvp/candidates/delete",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const { ids } = req.body ?? {};

        if (!Array.isArray(ids) || !ids.length) {
          return res
            .status(400)
            .json({
              error: "ids musi być niepustą tablicą identyfikatorów.",
              code: "server.idsArray",
            });
        }

        if (ids.length > LIMIT_HURTOWY) {
          return res.status(400).json({
            error: `Naraz można usunąć najwyżej ${LIMIT_HURTOWY} kandydatów.`,
          });
        }

        // Te same id potrafia przyjsc dwa razy przy szybkim klikaniu; bez
        // odsiania kandydat trafilby raz do usunietych, a raz do odrzuconych.
        const identyfikatory = [
          ...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)),
        ];

        if (!identyfikatory.length) {
          return res
            .status(400)
            .json({
              error: "Żaden z podanych identyfikatorów nie jest poprawny.",
              code: "server.noValidIds",
            });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const doUsuniecia = [];
        const odrzucone = [];

        for (const candidateId of identyfikatory) {
          const ocena = await sprawdzKandydataDoUsuniecia(
            pool,
            guildId,
            event.id,
            candidateId,
          );

          if (ocena.blad) {
            odrzucone.push({
              id: candidateId,
              nickname: ocena.candidate?.nickname ?? null,
              reason: ocena.blad,
            });
            continue;
          }

          doUsuniecia.push(ocena.candidate);
        }

        // Wszystko albo nic w obrebie tego, co przeszlo kontrole: admin
        // klikajacy "usun 92" ma dostac 92 skasowane albo zadnego, a nie
        // polowe i blad polaczenia w srodku.
        if (doUsuniecia.length) {
          await runInTransaction(pool, async (conn) => {
            for (const kandydat of doUsuniecia) {
              await conn.query(
                `
                DELETE FROM mvp_candidates
                WHERE id = ?
                  AND guild_id = ?
                  AND event_id = ?
                `,
                [kandydat.id, guildId, event.id],
              );
            }
          });
        }

        res.json({
          ok: true,
          deleted: doUsuniecia.map((k) => k.id),
          refused: odrzucone,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/mvp/result",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const candidateId = Number(req.body.candidateId);

        if (!Number.isInteger(candidateId) || candidateId <= 0) {
          return res.status(400).json({
            error: "Wymagany jest identyfikator kandydata.",
            code: "server.candidateIdRequired",
          });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        await pool.query(
          `
              INSERT INTO mvp_results (guild_id, event_id, candidate_id, active)
              VALUES (?, ?, ?, 1)
              ON DUPLICATE KEY UPDATE
                  candidate_id = VALUES(candidate_id),
                  active = 1,
                  updated_at = CURRENT_TIMESTAMP
              `,
          [guildId, event.id, candidateId],
        );

        res.json({ ok: true, candidateId });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  // Start typowania spoza Discorda.
  //
  // Panel na Discordzie publikuje wyłącznie publishPickemPanel() - ta sama
  // funkcja dla komendy, auto-startu i tego endpointu. API nie może wywołać jej
  // wprost, bo bot i serwer to dwa osobne procesy PM2 dzielące tylko bazę:
  // serwer nie ma klienta Discorda, więc nie ma czym wysłać wiadomości.
  //
  // Dlatego zapisujemy tu intencję w kolumnach auto_start_*, a bot podnosi ją
  // w ciągu ~30 s swoim watcherem i publikuje panel. Intencja jest trwała, więc
  // restart bota w złym momencie niczego nie gubi, a każdy kolejny klient
  // (aplikacja mobilna) dostaje tę samą ścieżkę za darmo.
  app.post(
    "/api/events/:slug/pickem/start",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        // Przyjmujemy oba zapisy fazy: panelowy ('swiss_stage1') i ten
        // z events.phase ('SWISS_STAGE_1'), żeby front mógł podać to, co ma.
        const surowa = String(req.body?.faza || req.body?.phase || "").trim();

        const faza = FAZY_PANELU_CONFIG[surowa]
          ? surowa
          : FAZA_PANELU[surowa.toUpperCase()];

        if (!faza) {
          return res.status(400).json({
            error: "Nieznana faza typowania.",
            dozwolone: Object.keys(FAZY_PANELU_CONFIG),
          });
        }

        const [[event]] = await pool.query(
          `SELECT id, name, status, is_open, is_active, is_archived,
                  auto_started_at
             FROM events
            WHERE guild_id = ? AND slug = ?
            LIMIT 1`,
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        if (Number(event.is_archived) === 1 || event.status === "FINISHED") {
          return res.status(409).json({
            error: "Ten turniej jest już zakończony.",
            code: "server.eventAlreadyFinished",
          });
        }

        // Kanał: jawnie podany wygrywa, w przeciwnym razie PICKEM_CHANNEL_ID
        // z configu gildii. Na Discordzie kanał bierze się z tego, gdzie admin
        // wpisał komendę - z WWW nie ma takiego odpowiednika.
        const kanalZConfigu =
          guildRegistry.getGuildConfig(guildId)?.PICKEM_CHANNEL_ID;

        const channelId = String(req.body?.channelId || kanalZConfigu || "").trim();

        if (!channelId) {
          return res.status(400).json({
            error:
              "Nie wiadomo, na którym kanale opublikować panel. " +
              "Ustaw PICKEM_CHANNEL_ID w configu serwera albo podaj channelId.",
            code: "server.noChannel",
            // Wskazówka techniczna zostaje po polsku: nazwy zmiennych
            // środowiskowych nie tłumaczy się na żaden język.
            hint: "Ustaw PICKEM_CHANNEL_ID w configu serwera albo podaj channelId.",
          });
        }

        // Cofamy event do UPCOMING / 0 / 0, bo watcher bota podnosi z kolejki
        // tylko taki stan - ten warunek chroni trwający turniej przed przejęciem
        // przez zaplanowany auto-start.
        //
        // Przy starcie wywołanym ręcznie przejęcie jest właśnie tym, o co chodzi.
        // Bez cofnięcia stanu nie dałoby się uruchomić typowania eventu, który
        // ktoś wcześniej otworzył przyciskiem "Otwórz event" - a ten przycisk
        // ustawia OPEN, nie publikując żadnego panelu.
        //
        // publishPickemPanel ustawi z powrotem OPEN / 1 / 1 razem z panelem.
        // Do tego czasu UPCOMING jest stanem prawdziwszym niż OPEN: panelu
        // jeszcze nie ma, więc turniej realnie nie jest otwarty.
        const [wynik] = await pool.query(
          `UPDATE events
              SET status = 'UPCOMING',
                  is_open = 0,
                  is_active = 0,
                  auto_start_at = UTC_TIMESTAMP(),
                  auto_start_phase = ?,
                  auto_start_channel_id = ?,
                  auto_started_at = NULL
            WHERE id = ? AND guild_id = ?
              AND COALESCE(is_archived, 0) = 0
              AND status <> 'FINISHED'
            LIMIT 1`,
          [faza, channelId, event.id, guildId],
        );

        if (wynik.affectedRows === 0) {
          return res.status(409).json({
            error: "Stan turnieju zmienił się w trakcie. Odśwież i spróbuj ponownie.",
            code: "server.eventChanged",
          });
        }

        logInfo("pickem", "Pick'Em start queued from web", {
          guildId,
          eventId: event.id,
          by: req.session?.user?.id,
          extra: { faza, channelId },
        });

        emitDashboardRefresh({ slug, guildId, reason: "pickem_start_queued" });

        return res.json({
          ok: true,
          slug,
          faza,
          channelId,
          // Watcher bota tyka co 30 s - front ma co pokazać zamiast
          // sugerować, że panel jest już na Discordzie.
          opoznienieSekundy: 30,
        });
      } catch (err) {
        console.error("PICKEM START:", err);
        return res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/phase",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const { phase } = req.body;

        const allowedPhases = [
          "NOT_STARTED",
          "PLAY_IN",
          "SWISS",
          "SWISS_STAGE_1",
          "SWISS_STAGE_2",
          "SWISS_STAGE_3",
          "DOUBLE_ELIM",
          "PLAYOFFS",
          "FINISHED",
        ];

        if (!allowedPhases.includes(phase)) {
          return res.status(400).json({
            error: "Invalid phase",
            allowedPhases,
          });
        }

        const [result] = await pool.query(
          `
          UPDATE events
          SET phase = ?
          WHERE guild_id = ?
            AND slug = ?
          LIMIT 1
          `,
          [phase, guildId, slug],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        io.emit("dashboard:refresh", { slug });

        res.json({
          ok: true,
          slug,
          phase,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );
}
