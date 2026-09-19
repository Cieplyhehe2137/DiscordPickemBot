// Publiczne wejscie na strone: archiwa, lista serwerow z botem i przeglad
// pojedynczej gildii.
//
// UWAGA na kolejnosc: /api/public/servers musi zostac PRZED
// /api/public/:guildSlug, inaczej parametr zlapie slowo "servers" i lista
// serwerow przestanie istniec. Dlatego te trasy sa w jednym module i w tej
// samej kolejnosci - npm run routes wywala sie takze na przestawieniu.

import { createGuildInfo } from "../lib/guildInfo.js";
import { buildAllTime } from "../lib/allTime.js";
import { SQL_NAZWY } from "./upsets.js";

export function registerPublicOverviewRoutes(
  app,
  {
    buildPublicMatch,
    guildRegistry,
    pool,
  },
) {
  app.get("/api/public/archives", async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
              SELECT
                  id,
                  guild_id,
                  filename,
                  created_at
              FROM archive_files
              ORDER BY created_at DESC
              `,
      );

      res.json(rows);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać archiwum.",
        code: "server.archiveLoadFailed",
      });
    }
  });

  // Oba helpery mieszkaja w server/lib/guildInfo.js - getKnownGuildInfo jest
  // potrzebne takze w app.js, w liscie eventow, ktora zostala poza tym modulem.
  const { getKnownGuildInfo, resolveGuildIdFromSlug } =
    createGuildInfo(guildRegistry);

  app.get("/api/public/servers", async (req, res) => {
    try {
      const [servers] = await pool.query(
        `
      SELECT
          e.guild_id,
          COUNT(*) AS events_count,
          SUM(e.status = 'OPEN') AS open_events
      FROM events e
      WHERE e.guild_id IS NOT NULL
      GROUP BY e.guild_id
      ORDER BY events_count DESC
      `,
      );

      const [featuredEvents] = await pool.query(
        `
      SELECT
          e.id,
          e.name,
          e.slug,
          e.phase,
          e.status,
          e.guild_id
      FROM events e
      ORDER BY e.id DESC
      LIMIT 6
      `,
      );

      // Lista serwerów pochodzi z konfiguracji bota, a nie z tabeli events.
      //
      // Wcześniej budowało ją samo GROUP BY po eventach, więc serwer pojawiał
      // się na stronie dopiero po utworzeniu pierwszego turnieju - obsługiwany
      // serwer, na którym nikt jeszcze nic nie założył, był niewidoczny.
      const statystyki = new Map(
        servers.map((row) => [String(row.guild_id), row]),
      );

      // Gildia, która ma eventy, ale straciła config (np. usunięty plik),
      // zostaje na liście - inaczej jej turnieje zniknęłyby ze strony.
      const wszystkieId = [
        ...new Set([
          ...guildRegistry.getAllGuildIds().map(String),
          ...statystyki.keys(),
        ]),
      ];

      const lista = wszystkieId
        .map((guildId) => {
          const known = getKnownGuildInfo(guildId);
          const stat = statystyki.get(guildId);

          return {
            guild_id: guildId,
            name: known.name,
            slug: known.slug,
            events_count: Number(stat?.events_count || 0),
            open_events: Number(stat?.open_events || 0),
            discord_url: known.discord_url,
          };
        })
        .sort(
          (a, b) =>
            b.open_events - a.open_events ||
            b.events_count - a.events_count ||
            String(a.name).localeCompare(String(b.name), "pl"),
        );

      res.json({
        servers: lista,
        featured_events: featuredEvents,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });

  app.get("/api/public/:guildSlug", async (req, res) => {
    try {
      const { guildSlug } = req.params;

      const guildId = resolveGuildIdFromSlug(guildSlug);
      const known = getKnownGuildInfo(guildId);

      const [events] = await pool.query(
        `
              SELECT
                  id,
                  name,
                  slug,
                  phase,
                  status
              FROM events
              WHERE guild_id = ?
              ORDER BY id DESC
              LIMIT 12
              `,
        [guildId],
      );

      const [[stats]] = await pool.query(
        `
      SELECT
          COUNT(DISTINCT e.id) AS events_count,
          COUNT(DISTINCT mp.user_id) AS participants,
          COUNT(mp.user_id) AS predictions
      FROM events e
      LEFT JOIN match_predictions mp
          ON mp.event_id = e.id
      WHERE e.guild_id = ?
      `,
        [guildId],
      );

      // CZOLOWKA SERWERA LICZONA PERCENTYLEM, NIE SUMA PUNKTOW.
      //
      // Stala tu wczesniej suma total_points po turniejach - dokladnie to,
      // co server/lib/allTime.js odrzuca i tlumaczy dlaczego: punkty z roznych
      // turniejow sa nieporownywalne. Na tym serwerze IEM Cologne dawalo
      // maksymalnie 316 punktow, a StarLadder Budapest 47, bo nie mial ani
      // jednego meczu. Suma robila z tego ranking tego, KTO GRAL W COLOGNE.
      //
      // Teraz liczy to ten sam modul, co klasyfikacja wszech czasow, wiec
      // gracz widzi te sama miare na obu stronach zamiast dwoch liczb na
      // jedno pytanie.
      const [wierszeKlasyfikacji] = await pool.query(
        `
        SELECT
            r.user_id,
            r.event_id,
            r.total_points,
            r.rank_position,
            r.uczestnicy,

            e.name,
            e.slug,

            p.displayname,
            p.avatar

        FROM (
            SELECT
                event_id,
                CAST(user_id AS CHAR CHARACTER SET utf8mb4)
                  COLLATE utf8mb4_unicode_ci AS user_id,

                COALESCE(total_points, 0) AS total_points,

                ROW_NUMBER() OVER (
                    PARTITION BY event_id
                    ORDER BY
                        COALESCE(total_points, 0) DESC,
                        user_id ASC
                ) AS rank_position,

                COUNT(*) OVER (PARTITION BY event_id) AS uczestnicy

            FROM leaderboard
            WHERE event_id IN (SELECT id FROM events WHERE guild_id = ?)
        ) r

        INNER JOIN events e
            ON e.id = r.event_id

        LEFT JOIN user_profiles p
            ON CAST(p.user_id AS CHAR CHARACTER SET utf8mb4)
               COLLATE utf8mb4_unicode_ci = r.user_id
        `,
        [guildId],
      );

      // Nazwy graczy, ktorzy nigdy nie logowali sie na stronie. Bez tego
      // w czolowce stalyby surowe dziewietnastocyfrowe identyfikatory -
      // wiersz w user_profiles powstaje dopiero przy logowaniu, a wiekszosc
      // typuje wylacznie na Discordzie.
      const [nazwyZFaz] = await pool.query(SQL_NAZWY);

      const featuredEvent =
        events.find((e) => e.status === "OPEN") || events[0] || null;

      // Nazwa z profilu ma pierwszenstwo przed nazwa z fazy: profil niesie
      // awatar i jest odswiezany przy kazdym logowaniu, a zapis z fazy
      // pamieta nick z dnia typowania. Ta sama kolejnosc, co na stronie
      // niespodzianek i przy rywalach.
      const nazwy = new Map();

      for (const n of nazwyZFaz) {
        if (n?.user_id) nazwy.set(String(n.user_id), n.displayname);
      }

      const wiersze = wierszeKlasyfikacji.map((r) => ({
        ...r,
        displayname: r.displayname || nazwy.get(String(r.user_id)) || null,
      }));

      // PROG DOPASOWANY DO SERWERA, a nie sztywne dwa starty.
      //
      // Klasyfikacja wszech czasow wymaga dwoch startow i slusznie - bez
      // progu czolowke zajmuja jednorazowi gracze. Ale serwer, ktory
      // rozegral JEDEN turniej, nie ma nikogo z dwoma startami: zmierzone,
      // 221 graczy z takiego serwera nie moze tam wejsc i nie zalezy to od
      // nich, tylko od tego, ile turniejow zrobil ich serwer.
      //
      // Tutaj prog to dwa starty ALBO tyle, ile serwer w ogole rozegral -
      // co jest mniejsze. Dzieki temu kazda spolecznosc ma swoja czolowke
      // od pierwszego turnieju.
      const turniejow = Number(stats?.events_count || 0);
      const progStartow = Math.max(1, Math.min(2, turniejow));

      res.json({
        guild: {
          guild_id: guildId,
          slug: known.slug,
          name: known.name,
          discord_url: known.discord_url,
        },
        stats: {
          events: Number(stats?.events_count || 0),
          participants: Number(stats?.participants || 0),
          predictions: Number(stats?.predictions || 0),
        },

        // Dziesiatka, nie piatka: to jest czolowka calej spolecznosci,
        // a nie kafelek na stronie glownej.
        top_players: buildAllTime(wiersze, { minStarts: progStartow }).slice(
          0,
          10,
        ),

        // Prog jedzie razem z danymi - strona ma powiedziec wprost, czego
        // brakuje komus, kogo w tabeli nie ma.
        min_starts: progStartow,

        featured_event: featuredEvent,
        events,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });

  app.get("/api/public/:slug/overview", async (req, res) => {
    try {
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
        SELECT
    id,
    guild_id,
    name,
    slug,
    phase,
    status
  FROM events
  WHERE slug = ?
  LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      const [leaderboard] = await pool.query(
        `
    SELECT
      user_id,
      total_points
    FROM leaderboard
    WHERE event_id = ?
    ORDER BY total_points DESC
    LIMIT 10
    `,
        [event.id],
      );

      const [matches] = await pool.query(
        `
    SELECT
    m.id,
    m.phase,
    m.match_no,
    m.team_a,
    m.team_b,
    m.best_of,
    m.start_time_utc,
    m.is_locked,

    COALESCE(lms.score_a, 0) AS score_a,
    COALESCE(lms.score_b, 0) AS score_b,
    lms.current_map,
    lms.status AS live_status,

    CASE
      WHEN m.is_locked = 1 THEN 'LOCKED'
      ELSE 'OPEN'
    END AS ui_status

  FROM matches m
  LEFT JOIN live_match_scores lms
    ON lms.match_id = m.id
  WHERE m.event_id = ?
  ORDER BY m.match_no ASC, m.id ASC
  LIMIT 8
    `,
        [event.id],
      );

      const [[stats]] = await pool.query(
        `
    SELECT
      COUNT(*) AS matches
    FROM matches
    WHERE event_id = ?
    `,
        [event.id],
      );

      const [[predictionStats]] = await pool.query(
        `
    SELECT
      COUNT(DISTINCT user_id) AS participants,
      COUNT(*) AS predictions
    FROM match_predictions
    WHERE event_id = ?
    `,
        [event.id],
      );

      const publicMatches = matches.map(buildPublicMatch);

      const featuredMatch =
        publicMatches.find((match) => match.ui_status === "LIVE") ||
        publicMatches.find((match) => match.ui_status === "OPEN") ||
        publicMatches[0] ||
        null;

      res.json({
        event,
        // Zaproszenie na Discorda bierze się z configu gildii, a nie ze
        // stałej w kodzie. Gildie bez DISCORD_INVITE_URL dostają null i
        // front po prostu nie rysuje przycisku - lepiej nie pokazać nic
        // niż pokazać link prowadzący donikąd.
        guild: getKnownGuildInfo(event.guild_id),
        stats: {
          participants: predictionStats?.participants || 0,
          predictions: predictionStats?.predictions || 0,
          matches: stats?.matches || 0,
          phase: event.phase,
        },
        leaderboard,
        featured_match: featuredMatch,
        matches: publicMatches,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });
}
