const { phasesConfig, buildPickemPanel } = require("./pickemPanelBuilder");

async function publishPickemPanel({
  client,
  pool,
  guildId,
  eventId,
  phase,
  channelId,
}) {
  const config = phasesConfig[phase];

  if (!config) {
    throw new Error(`Unknown Pick'Em phase: ${phase}`);
  }

  // ======================================================
  // EVENT
  // ======================================================

  const [events] = await pool.query(
    `
    SELECT
      id,
      name,
      slug,
      status
    FROM events
    WHERE id = ?
      AND guild_id = ?
    LIMIT 1
    `,
    [eventId, guildId],
  );

  const event = events[0];

  if (!event) {
    throw new Error(`Event ${eventId} not found for guild ${guildId}`);
  }

  // ======================================================
  // KANAŁ
  // ======================================================

  const channel = await client.channels.fetch(String(channelId));

  if (!channel || typeof channel.send !== "function") {
    throw new Error(`Target channel ${channelId} is not sendable`);
  }

  // ======================================================
  // BUILD PANELU
  // ======================================================

  const isSwiss = phase.startsWith("swiss_stage");

  const payload = buildPickemPanel({
    event,
    eventId,
    phase,
  });

  // ======================================================
  // PUBLIKACJA
  // ======================================================

  const message = await channel.send({
    content: "@everyone",

    ...payload,

    allowedMentions: {
      parse: ["everyone"],
    },
  });

  // ======================================================
  // EVENT
  // ======================================================

  await pool.query(
    `
    UPDATE events
    SET
      phase = ?,
      status = 'OPEN',
      is_open = 1,
      is_active = 1
    WHERE id = ?
      AND guild_id = ?
    `,
    [phase, eventId, guildId],
  );

  // ======================================================
  // WYŁĄCZENIE POPRZEDNIEGO PANELU
  // ======================================================

  await pool.query(
    `
    UPDATE active_panels
    SET active = 0
    WHERE guild_id = ?
      AND phase = ?
    `,
    [guildId, phase],
  );

  // ======================================================
  // PANEL SWISS
  // ======================================================

  if (isSwiss) {
    await pool.query(
      `
      INSERT INTO active_panels (
        guild_id,
        phase,
        stage,
        message_id,
        channel_id,
        reminded,
        closed,
        active,
        deadline
      )

      VALUES (
        ?, ?, ?, ?, ?,
        0, 0, 1, NULL
      )

      ON DUPLICATE KEY UPDATE
        message_id = VALUES(message_id),
        channel_id = VALUES(channel_id),
        stage = VALUES(stage),
        reminded = 0,
        closed = 0,
        closed_at = NULL,
        active = 1,
        deadline = NULL
      `,
      [guildId, phase, config.stage, message.id, channel.id],
    );
  }

  // ======================================================
  // POZOSTAŁE FAZY
  // ======================================================
  else {
    await pool.query(
      `
      INSERT INTO active_panels (
        guild_id,
        phase,
        channel_id,
        message_id,
        active,
        reminded,
        closed,
        deadline
      )

      VALUES (
        ?, ?, ?, ?,
        1, 0, 0, NULL
      )

      ON DUPLICATE KEY UPDATE
        message_id = VALUES(message_id),
        channel_id = VALUES(channel_id),
        active = 1,
        reminded = 0,
        closed = 0,
        closed_at = NULL,
        deadline = NULL
      `,
      [guildId, phase, channel.id, message.id],
    );
  }

  // ======================================================
  // RETURN
  // ======================================================

  return {
    event,
    message,
    config,
  };
}

module.exports = {
  phasesConfig,
  publishPickemPanel,
};
