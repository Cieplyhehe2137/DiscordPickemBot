// utils/archivePlayerEventStats.js

const { logInfo } = require("./logger");

function winnerSide(a, b) {
  const left = Number(a);
  const right = Number(b);

  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

function isWinnerCorrect(row) {
  const predicted = winnerSide(row.pred_a, row.pred_b);
  const official = winnerSide(row.res_a, row.res_b);

  return predicted !== 0 && predicted === official;
}

function isSeriesExact(row) {
  if (Number(row.best_of) === 1) {
    return (
      row.pred_exact_a != null &&
      row.pred_exact_b != null &&
      row.exact_a != null &&
      row.exact_b != null &&
      Number(row.pred_exact_a) === Number(row.exact_a) &&
      Number(row.pred_exact_b) === Number(row.exact_b)
    );
  }

  return (
    row.pred_a != null &&
    row.pred_b != null &&
    row.res_a != null &&
    row.res_b != null &&
    Number(row.pred_a) === Number(row.res_a) &&
    Number(row.pred_b) === Number(row.res_b)
  );
}

function isMapWinnerCorrect(row) {
  const predicted = winnerSide(row.pred_exact_a, row.pred_exact_b);
  const official = winnerSide(row.exact_a, row.exact_b);

  return predicted !== 0 && predicted === official;
}

function isMapExact(row) {
  return (
    row.pred_exact_a != null &&
    row.pred_exact_b != null &&
    row.exact_a != null &&
    row.exact_b != null &&
    Number(row.pred_exact_a) === Number(row.exact_a) &&
    Number(row.pred_exact_b) === Number(row.exact_b)
  );
}

function calculateBestStreak(rows) {
  let current = 0;
  let best = 0;

  for (const row of rows) {
    if (isWinnerCorrect(row)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

module.exports = async function archivePlayerEventStats({
  conn,
  guildId,
  eventId,
  eventName,
}) {
  if (!conn) {
    throw new Error("archivePlayerEventStats: missing DB connection");
  }

  if (!guildId || !eventId) {
    throw new Error("archivePlayerEventStats: missing guildId/eventId");
  }

  // ======================================================
  // UCZESTNICY
  // ======================================================

  const [participants] = await conn.query(
    `
      SELECT DISTINCT
        user_id
      FROM match_predictions
      WHERE guild_id = ?
        AND event_id = ?
    `,
    [guildId, eventId],
  );

  if (!participants.length) {
    logInfo("tournament", "No player stats to archive", {
      guildId,
      eventId,
    });

    return {
      archivedPlayers: 0,
    };
  }

  const participantCount = participants.length;

  // ======================================================
  // WSZYSTKIE ROZLICZONE TYPY
  // ======================================================

  const [settledRows] = await conn.query(
    `
      SELECT
        mp.user_id,

        m.id AS match_id,
        m.match_no,
        m.best_of,

        mp.pred_a,
        mp.pred_b,
        mp.pred_exact_a,
        mp.pred_exact_b,

        mr.res_a,
        mr.res_b,
        mr.exact_a,
        mr.exact_b,
        mr.finished_at

      FROM match_predictions mp

      INNER JOIN matches m
        ON m.id = mp.match_id
       AND m.guild_id = mp.guild_id
       AND m.event_id = mp.event_id

      INNER JOIN match_results mr
        ON mr.match_id = mp.match_id
       AND mr.guild_id = mp.guild_id
       AND mr.event_id = mp.event_id

      WHERE mp.guild_id = ?
        AND mp.event_id = ?

      ORDER BY
        mp.user_id ASC,
        mr.finished_at ASC,
        m.id ASC
    `,
    [guildId, eventId],
  );

  // ======================================================
  // LICZBA ODDANYCH TYPÓW
  // ======================================================

  const [predictionRows] = await conn.query(
    `
      SELECT
        user_id,
        COUNT(*) AS total
      FROM match_predictions
      WHERE guild_id = ?
        AND event_id = ?
      GROUP BY user_id
    `,
    [guildId, eventId],
  );

  // ======================================================
  // MAPY
  // ======================================================

  const [mapRowsRaw] = await conn.query(
    `
      SELECT
        p.user_id,
        p.match_id,
        p.map_no,

        p.pred_exact_a,
        p.pred_exact_b,

        r.exact_a,
        r.exact_b

      FROM match_map_predictions p

      INNER JOIN match_map_results r
        ON r.guild_id = p.guild_id
       AND r.event_id = p.event_id
       AND r.match_id = p.match_id
       AND r.map_no = p.map_no

      WHERE p.guild_id = ?
        AND p.event_id = ?
    `,
    [guildId, eventId],
  );

  // ======================================================
  // PUNKTY
  // ======================================================

  const [pointsRows] = await conn.query(
    `
      SELECT
        user_id,

        COALESCE(
          SUM(
            CASE
              WHEN source = 'series'
              THEN points
              ELSE 0
            END
          ),
          0
        ) AS series_points,

        COALESCE(
          SUM(
            CASE
              WHEN source = 'map'
              THEN points
              ELSE 0
            END
          ),
          0
        ) AS map_points,

        COALESCE(SUM(points), 0) AS total_points

      FROM match_points

      WHERE guild_id = ?
        AND event_id = ?

      GROUP BY user_id
    `,
    [guildId, eventId],
  );

  // ======================================================
  // MAPY / MECZE PER USER
  // ======================================================

  const settledByUser = new Map();
  const mapsByUser = new Map();

  for (const row of settledRows) {
    const userId = String(row.user_id);

    if (!settledByUser.has(userId)) {
      settledByUser.set(userId, []);
    }

    settledByUser.get(userId).push(row);
  }

  for (const row of mapRowsRaw) {
    const userId = String(row.user_id);

    if (!mapsByUser.has(userId)) {
      mapsByUser.set(userId, []);
    }

    mapsByUser.get(userId).push({
      ...row,
      map_no: Number(row.map_no),
    });
  }

  // ======================================================
  // BO1 = JEDNA MAPA
  //
  // Identyczna zasada jak w "Moje statystyki":
  // jeśli BO1 nie istnieje już w tabeli mapowej,
  // dokładamy wynik z match_predictions/results.
  // ======================================================

  for (const participant of participants) {
    const userId = String(participant.user_id);

    const userSettledRows = settledByUser.get(userId) || [];

    if (!mapsByUser.has(userId)) {
      mapsByUser.set(userId, []);
    }

    const userMapRows = mapsByUser.get(userId);

    const existingKeys = new Set(
      userMapRows.map((row) => `${row.match_id}:${row.map_no}`),
    );

    for (const row of userSettledRows) {
      if (Number(row.best_of) !== 1) {
        continue;
      }

      const key = `${row.match_id}:1`;

      if (existingKeys.has(key)) {
        continue;
      }

      if (
        row.pred_exact_a == null ||
        row.pred_exact_b == null ||
        row.exact_a == null ||
        row.exact_b == null
      ) {
        continue;
      }

      userMapRows.push({
        user_id: userId,
        match_id: row.match_id,
        map_no: 1,

        pred_exact_a: row.pred_exact_a,
        pred_exact_b: row.pred_exact_b,

        exact_a: row.exact_a,
        exact_b: row.exact_b,
      });

      existingKeys.add(key);
    }
  }

  // ======================================================
  // LOOKUPY
  // ======================================================

  const predictionsByUser = new Map(
    predictionRows.map((row) => [String(row.user_id), Number(row.total || 0)]),
  );

  const pointsByUser = new Map(
    pointsRows.map((row) => [
      String(row.user_id),
      {
        totalPoints: Number(row.total_points || 0),
        seriesPoints: Number(row.series_points || 0),
        mapPoints: Number(row.map_points || 0),
      },
    ]),
  );

  // ======================================================
  // RANKING
  //
  // Taki sam mechanizm jak obecnie w Moje statystyki:
  // miejsce = liczba graczy mających więcej punktów + 1.
  //
  // Dzięki temu remisy dostają to samo miejsce.
  // ======================================================

  const ranking = participants
    .map((participant) => {
      const userId = String(participant.user_id);

      return {
        userId,
        points: pointsByUser.get(userId)?.totalPoints || 0,
      };
    })
    .sort((a, b) => b.points - a.points);

  // ======================================================
  // SNAPSHOTY
  // ======================================================

  let archivedPlayers = 0;

  for (const participant of participants) {
    const userId = String(participant.user_id);

    const userSettledRows = settledByUser.get(userId) || [];
    const userMapRows = mapsByUser.get(userId) || [];

    const points = pointsByUser.get(userId) || {
      totalPoints: 0,
      seriesPoints: 0,
      mapPoints: 0,
    };

    const predictions = predictionsByUser.get(userId) || 0;

    const settledMatches = userSettledRows.length;

    const winnerHits = userSettledRows.filter(isWinnerCorrect).length;

    const seriesExacts = userSettledRows.filter(isSeriesExact).length;

    const settledMaps = userMapRows.length;

    const mapWinnerHits = userMapRows.filter(isMapWinnerCorrect).length;

    const exactMaps = userMapRows.filter(isMapExact).length;

    const bestStreak = calculateBestStreak(userSettledRows);

    const finalRank =
      ranking.filter(
        (player) => Number(player.points) > Number(points.totalPoints),
      ).length + 1;

    await conn.query(
      `
        INSERT INTO player_event_history (
          guild_id,
          event_id,
          user_id,

          event_name,

          final_rank,
          participant_count,

          total_points,
          series_points,
          map_points,

          predictions,
          settled_matches,

          winner_hits,
          series_exacts,

          settled_maps,
          map_winner_hits,
          exact_maps,

          best_streak,

          finished_at
        )
        VALUES (
          ?, ?, ?,
          ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?,
          UTC_TIMESTAMP()
        )

        ON DUPLICATE KEY UPDATE
          event_name = VALUES(event_name),

          final_rank = VALUES(final_rank),
          participant_count = VALUES(participant_count),

          total_points = VALUES(total_points),
          series_points = VALUES(series_points),
          map_points = VALUES(map_points),

          predictions = VALUES(predictions),
          settled_matches = VALUES(settled_matches),

          winner_hits = VALUES(winner_hits),
          series_exacts = VALUES(series_exacts),

          settled_maps = VALUES(settled_maps),
          map_winner_hits = VALUES(map_winner_hits),
          exact_maps = VALUES(exact_maps),

          best_streak = VALUES(best_streak),

          finished_at = VALUES(finished_at)
      `,
      [
        guildId,
        eventId,
        userId,

        eventName,

        finalRank,
        participantCount,

        points.totalPoints,
        points.seriesPoints,
        points.mapPoints,

        predictions,
        settledMatches,

        winnerHits,
        seriesExacts,

        settledMaps,
        mapWinnerHits,
        exactMaps,

        bestStreak,
      ],
    );

    archivedPlayers += 1;
  }

  logInfo("tournament", "Player event history archived", {
    guildId,
    eventId,
    eventName,
    participantCount,
    archivedPlayers,
  });

  return {
    archivedPlayers,
    participantCount,
  };
};
