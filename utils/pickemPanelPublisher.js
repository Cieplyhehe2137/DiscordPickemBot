const { phasesConfig, buildPickemPanel } = require("./pickemPanelBuilder");

// ======================================================
// PUBLISH PICK'EM PANEL
// ======================================================

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

  // ====================================================
  // EVENT
  // ====================================================

  const [events] = await pool.query(
    `
    SELECT
      id,
      name,
      slug,
      status,
      phase,
      is_open,
      is_active
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

  // ====================================================
  // CHANNEL
  // ====================================================

  const channel = await client.channels.fetch(String(channelId));

  if (!channel || typeof channel.send !== "function") {
    throw new Error(`Target channel ${channelId} is not sendable`);
  }

  // ====================================================
  // BUILD PANEL
  // ====================================================

  const isSwiss = phase.startsWith("swiss_stage");

  const payload = buildPickemPanel({
    event,
    eventId,
    phase,
  });

  // ====================================================
  // SEND DISCORD MESSAGE
  // ====================================================

  const message = await channel.send({
    content: "@everyone",

    ...payload,

    allowedMentions: {
      parse: ["everyone"],
    },
  });

  // ====================================================
  // DATABASE TRANSACTION
  // ====================================================

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ==================================================
    // LOCK EVENT ROWS FOR THIS GUILD
    // ==================================================
    //
    // Dzięki temu dwa równoległe publishery nie powinny
    // aktywować dwóch eventów jednocześnie.
    // ==================================================

    await connection.query(
      `
      SELECT id
      FROM events
      WHERE guild_id = ?
      FOR UPDATE
      `,
      [guildId],
    );

    // ==================================================
    // DEACTIVATE OTHER EVENTS
    // ==================================================
    //
    // Tylko aktualnie OPEN dostają CLOSED.
    //
    // UPCOMING / FINISHED / inne statusy zachowują swój
    // status, ale tracą is_open / is_active.
    // ==================================================

    await connection.query(
      `
      UPDATE events
      SET
        status = CASE
          WHEN status = 'OPEN' THEN 'CLOSED'
          ELSE status
        END,
        is_open = 0,
        is_active = 0
      WHERE guild_id = ?
        AND id <> ?
      `,
      [guildId, eventId],
    );

    // ==================================================
    // ACTIVATE TARGET EVENT
    // ==================================================

    const [eventUpdate] = await connection.query(
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

    if (eventUpdate.affectedRows !== 1) {
      throw new Error(
        `Could not activate event ${eventId} for guild ${guildId}`,
      );
    }

    // ==================================================
    // DISABLE ALL OLD PANELS
    // ==================================================
    //
    // Nie tylko panel tej samej fazy.
    //
    // Skoro tylko jeden event/faza może być aktualnie
    // aktywna, stary panel Playoffs/Swiss/etc. również
    // nie powinien pozostać active=1.
    // ==================================================

    await connection.query(
      `
      UPDATE active_panels
      SET active = 0
      WHERE guild_id = ?
        AND active = 1
      `,
      [guildId],
    );

    // ==================================================
    // SWISS PANEL
    // ==================================================

    if (isSwiss) {
      await connection.query(
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

    // ==================================================
    // OTHER PHASES
    // ==================================================
    else {
      await connection.query(
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

    // ==================================================
    // COMMIT
    // ==================================================

    await connection.commit();
  } catch (error) {
    // ==================================================
    // ROLLBACK
    // ==================================================

    await connection.rollback().catch(() => {});

    // ==================================================
    // DELETE ORPHAN DISCORD PANEL
    // ==================================================
    //
    // Wiadomość Discord została wysłana przed transakcją.
    // Jeśli zapis DB się nie udał, próbujemy ją usunąć,
    // żeby nie został publiczny panel bez stanu w DB.
    // ==================================================

    await message.delete().catch(() => {});

    throw error;
  } finally {
    connection.release();
  }

  // ====================================================
  // RETURN
  // ====================================================

  return {
    event: {
      ...event,
      phase,
      status: "OPEN",
      is_open: 1,
      is_active: 1,
    },

    message,
    config,
  };
}

module.exports = {
  phasesConfig,
  publishPickemPanel,
};
