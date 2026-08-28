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

  eventId = Number(eventId);

  if (!eventId) {
    throw new Error("Invalid eventId");
  }

  // ====================================================
  // EVENT PRECHECK
  // ====================================================
  //
  // Pobieramy event przed wysłaniem wiadomości,
  // ponieważ jego dane są potrzebne do zbudowania panelu.
  //
  // Później, już wewnątrz transakcji, sprawdzimy go
  // ponownie pod blokadą FOR UPDATE.
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
      is_active,
      is_archived
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
  // DO NOT REOPEN FINISHED / ARCHIVED EVENTS
  // ====================================================

  if (
    event.status === "FINISHED" ||
    event.status === "ARCHIVED" ||
    Number(event.is_archived) === 1
  ) {
    throw new Error(`Event ${eventId} is finished or archived`);
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
  //
  // Najpierw Discord, potem DB.
  //
  // Nie chcemy trzymać blokady DB podczas oczekiwania
  // na Discord API.
  //
  // Jeżeli późniejsza transakcja DB się nie powiedzie,
  // wiadomość zostanie usunięta.
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
    // LOCK ALL EVENTS FOR THIS GUILD
    // ==================================================
    //
    // Serializujemy zmianę aktywnego eventu.
    //
    // Dwa publishery uruchomione niemal jednocześnie
    // nie powinny pozostawić dwóch aktywnych eventów.
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
    // REVALIDATE TARGET EVENT
    // ==================================================
    //
    // Stan eventu mógł zmienić się od wcześniejszego
    // SELECT-a do momentu rozpoczęcia transakcji.
    //
    // Dlatego sprawdzamy go ponownie już pod blokadą.
    // ==================================================

    const [lockedEvents] = await connection.query(
      `
      SELECT
        id,
        name,
        slug,
        status,
        phase,
        is_open,
        is_active,
        is_archived
      FROM events
      WHERE id = ?
        AND guild_id = ?
      LIMIT 1
      `,
      [eventId, guildId],
    );

    const lockedEvent = lockedEvents[0];

    if (!lockedEvent) {
      throw new Error(
        `Event ${eventId} disappeared before activation for guild ${guildId}`,
      );
    }

    if (
      lockedEvent.status === "FINISHED" ||
      lockedEvent.status === "ARCHIVED" ||
      Number(lockedEvent.is_archived) === 1
    ) {
      throw new Error(
        `Event ${eventId} became finished or archived before activation`,
      );
    }

    // ==================================================
    // DEACTIVATE OTHER EVENTS
    // ==================================================
    //
    // Dotychczasowy OPEN event staje się CLOSED.
    //
    // UPCOMING / FINISHED / ARCHIVED zachowują swój
    // status historyczny, ale nie mogą być aktywne.
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
    //
    // To jest właściwy moment aktywacji eventu.
    //
    // /start_pickem jedynie przygotowuje event jako
    // UPCOMING. Dopiero poprawnie opublikowany panel
    // zmienia go na:
    //
    // status    = OPEN
    // is_open   = 1
    // is_active = 1
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
        AND is_archived = 0
        AND status NOT IN ('FINISHED', 'ARCHIVED')
      `,
      [phase, eventId, guildId],
    );

    if (eventUpdate.affectedRows !== 1) {
      throw new Error(
        `Could not activate event ${eventId} for guild ${guildId}`,
      );
    }

    // ==================================================
    // DISABLE OLD PUBLIC PANELS
    // ==================================================
    //
    // Tylko jeden publiczny Pick'Em panel powinien być
    // aktualnie aktywny na guildzie.
    //
    // To jest również podstawa dla
    // assertActivePredictionPanel().
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

    // ==================================================
    // RETURN
    // ==================================================

    return {
      event: {
        ...lockedEvent,

        phase,
        status: "OPEN",
        is_open: 1,
        is_active: 1,
      },

      message,
      config,
    };
  } catch (error) {
    // ==================================================
    // ROLLBACK
    // ==================================================

    await connection.rollback().catch(() => {});

    // ==================================================
    // DELETE ORPHAN DISCORD PANEL
    // ==================================================
    //
    // Discord message powstała przed transakcją.
    //
    // Jeżeli DB nie zaakceptowała aktywacji eventu,
    // publiczny panel nie może pozostać na serwerze.
    // ==================================================

    await message.delete().catch(() => {});

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  phasesConfig,
  publishPickemPanel,
};
