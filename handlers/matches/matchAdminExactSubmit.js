const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { logError } = require("../../utils/logger");
const adminState = require("../../utils/matchAdminState");
const { withGuild } = require("../../utils/guildContext");
const recalculateMatchPoints = require("../../services/recalculateMatchPoints");
const { getMapLabel, maxMapsFromBo } = require("../../utils/mapLabels");
const { getMatchById } = require("../../utils/matchesStore");
const { emitDashboardRefresh } = require("../../utils/socket");
const { runInTransaction } = require("../../utils/runInTransaction");

/* ======================
   GUARDS
====================== */

function requireGuild(interaction) {
  if (!interaction.guildId) {
    interaction
      .reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      })
      .catch(() => {});

    return false;
  }

  return true;
}

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;

  return (
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  );
}

/* ======================
   SCORE VALIDATION
====================== */

function validateCs2Score(a, b) {
  const scoreA = Number(a);
  const scoreB = Number(b);

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return false;
  }

  if (scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
    return false;
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  // Regulaminowy wynik MR12:
  // 13:0 - 13:11
  if (winner === 13) {
    return loser >= 0 && loser <= 11;
  }

  // Dogrywki:
  // 16:12 / 16:13 / 16:14
  // 19:15 / 19:16 / 19:17
  // 22:18 itd.
  if (winner >= 16 && (winner - 16) % 3 === 0) {
    return loser >= winner - 4 && loser <= winner - 2;
  }

  return false;
}

/* ======================
   UTILS
====================== */

async function getDefaults(pool, guildId, eventId, matchId, maxMaps, mapNo) {
  try {
    if (maxMaps === 1) {
      const [[r]] = await pool.query(
        `
        SELECT exact_a, exact_b
        FROM match_results
        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
        LIMIT 1
        `,
        [guildId, eventId, matchId],
      );

      return {
        a: r?.exact_a ?? "",
        b: r?.exact_b ?? "",
      };
    }

    const [[r]] = await pool.query(
      `
      SELECT exact_a, exact_b
      FROM match_map_results
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
        AND map_no = ?
      LIMIT 1
      `,
      [guildId, eventId, matchId, mapNo],
    );

    return {
      a: r?.exact_a ?? "",
      b: r?.exact_b ?? "",
    };
  } catch {
    return {
      a: "",
      b: "",
    };
  }
}

function buildModal(match, maxMaps, mapNo, defaults) {
  const modal = new ModalBuilder()
    .setCustomId("match_admin_exact_submit")
    .setTitle(
      maxMaps === 1
        ? "Oficjalny dokładny wynik"
        : `Oficjalny dokładny wynik — ${getMapLabel(mapNo, match.best_of)}`,
    );

  const inA = new TextInputBuilder()
    .setCustomId("exact_a")
    .setLabel(`${match.team_a} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("np. 13")
    .setValue(defaults.a === "" ? "" : String(defaults.a));

  const inB = new TextInputBuilder()
    .setCustomId("exact_b")
    .setLabel(`${match.team_b} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("np. 8")
    .setValue(defaults.b === "" ? "" : String(defaults.b));

  modal.addComponents(
    new ActionRowBuilder().addComponents(inA),
    new ActionRowBuilder().addComponents(inB),
  );

  return modal;
}

/* ======================
   HANDLER
====================== */

module.exports = async function matchAdminExactSubmit(interaction) {
  try {
    if (!requireGuild(interaction) || !hasAdminPerms(interaction)) {
      return;
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const ctx = adminState.get(guildId, interaction.user.id);

      if (!ctx?.matchId) {
        return interaction.reply({
          content: "❌ Brak kontekstu meczu.",
          ephemeral: true,
        });
      }

      const exactA = Number(interaction.fields.getTextInputValue("exact_a"));

      const exactB = Number(interaction.fields.getTextInputValue("exact_b"));

      // =====================================
      // SCORE VALIDATION
      // =====================================

      if (!validateCs2Score(exactA, exactB)) {
        return interaction.reply({
          content:
            "❌ Nieprawidłowy wynik CS2. " +
            "Dozwolone np. **13:8, 13:11, 16:13, 19:17**.",
          ephemeral: true,
        });
      }

      // =====================================
      // MATCH
      // =====================================

      const match = await getMatchById(pool, guildId, ctx.matchId);

      if (!match) {
        adminState.clear(guildId, interaction.user.id);

        return interaction.reply({
          content: "❌ Mecz nie istnieje lub nie należy do tego serwera.",
          ephemeral: true,
        });
      }

      if (!match.event_id) {
        adminState.clear(guildId, interaction.user.id);

        return interaction.reply({
          content: "❌ Ten mecz nie ma przypisanego event_id.",
          ephemeral: true,
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);

      let mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 1);

      if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
        mapNo = 1;
      }

      let seriesFinished = maxMaps === 1;

      let finalResA = 0;
      let finalResB = 0;

      // =====================================
      // TRANSACTION
      // =====================================

      await runInTransaction(pool, async (conn) => {
        // ================================
        // BO1
        // ================================

        if (maxMaps === 1) {
          const resA = exactA > exactB ? 1 : 0;

          const resB = exactB > exactA ? 1 : 0;

          finalResA = resA;
          finalResB = resB;

          await conn.query(
            `
                  INSERT INTO match_results
                  (
                    guild_id,
                    event_id,
                    match_id,
                    res_a,
                    res_b,
                    exact_a,
                    exact_b,
                    finished_at
                  )
                  VALUES
                  (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

                  ON DUPLICATE KEY UPDATE
                    event_id = VALUES(event_id),
                    res_a = VALUES(res_a),
                    res_b = VALUES(res_b),
                    exact_a = VALUES(exact_a),
                    exact_b = VALUES(exact_b),
                    finished_at = CURRENT_TIMESTAMP
                  `,
            [guildId, match.event_id, match.id, resA, resB, exactA, exactB],
          );

          await conn.query(
            `
                  UPDATE matches
                  SET is_locked = 1
                  WHERE guild_id = ?
                    AND id = ?
                  `,
            [guildId, match.id],
          );
        }

        // ================================
        // BO3 / BO5
        // ================================
        else {
          await conn.query(
            `
                  INSERT INTO match_map_results
                  (
                    guild_id,
                    event_id,
                    match_id,
                    map_no,
                    exact_a,
                    exact_b
                  )
                  VALUES
                  (?, ?, ?, ?, ?, ?)

                  ON DUPLICATE KEY UPDATE
                    event_id = VALUES(event_id),
                    exact_a = VALUES(exact_a),
                    exact_b = VALUES(exact_b),
                    updated_at = CURRENT_TIMESTAMP
                  `,
            [guildId, match.event_id, match.id, mapNo, exactA, exactB],
          );

          // ==============================
          // CURRENT SERIES SCORE
          // ==============================

          const [savedResults] = await conn.query(
            `
                    SELECT
                      map_no,
                      exact_a,
                      exact_b
                    FROM match_map_results
                    WHERE guild_id = ?
                      AND event_id = ?
                      AND match_id = ?
                    ORDER BY map_no ASC
                    `,
            [guildId, match.event_id, match.id],
          );

          const winsNeeded = Math.ceil(Number(match.best_of) / 2);

          let resA = 0;
          let resB = 0;

          // Numer mapy, na której seria się rozstrzygnęła - potrzebny niżej
          // do skasowania map wpisanych ponad ten punkt.
          let mapaRozstrzygajaca = 0;

          for (const row of savedResults) {
            if (Number(row.exact_a) > Number(row.exact_b)) {
              resA += 1;
            } else if (Number(row.exact_b) > Number(row.exact_a)) {
              resB += 1;
            }

            mapaRozstrzygajaca = Number(row.map_no);

            if (resA === winsNeeded || resB === winsNeeded) {
              break;
            }
          }

          finalResA = resA;
          finalResB = resB;

          seriesFinished = resA === winsNeeded || resB === winsNeeded;

          // ==============================
          // SERIES FINISHED
          // ==============================

          if (seriesFinished) {
            // Mapy wpisane ponad rozstrzygnięcie serii są nieistniejące -
            // BO3 zakończone 2:0 nie ma mapy 3. Admin poprawiający wcześniej
            // wpisany wynik (np. z 2:1 na 2:0) zostawiał tu osierocony wiersz,
            // a recalculateMatchPoints nalicza punkty za każdą mapę, która ma
            // i typ, i wynik - więc taka mapa dalej punktowała graczy.
            await conn.query(
              `
              DELETE FROM match_map_results
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
                AND map_no > ?
              `,
              [guildId, match.event_id, match.id, mapaRozstrzygajaca],
            );

            await conn.query(
              `
                    INSERT INTO match_results
                    (
                      guild_id,
                      event_id,
                      match_id,
                      res_a,
                      res_b,
                      finished_at
                    )
                    VALUES
                    (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

                    ON DUPLICATE KEY UPDATE
                      event_id = VALUES(event_id),
                      res_a = VALUES(res_a),
                      res_b = VALUES(res_b),
                      exact_a = NULL,
                      exact_b = NULL,
                      finished_at = CURRENT_TIMESTAMP
                    `,
              [guildId, match.event_id, match.id, resA, resB],
            );

            await conn.query(
              `
                    UPDATE matches
                    SET is_locked = 1
                    WHERE guild_id = ?
                      AND id = ?
                    `,
              [guildId, match.id],
            );
          }
        }

        // ================================
        // RECALCULATE POINTS
        // ================================

        await recalculateMatchPoints(
          conn,
          guildId,
          match.event_id,
          match.id,
          match.best_of,
        );
      });

      const [[eventRow]] = await pool.query(
        `
  SELECT slug
  FROM events
  WHERE guild_id = ?
    AND id = ?
  LIMIT 1
  `,
        [guildId, match.event_id],
      );

      emitDashboardRefresh({
        slug: eventRow?.slug ?? null,
        guildId,
        eventId: match.event_id,
        matchId: match.id,
        phase: match.phase,
        reason: seriesFinished ? "match_finished" : "map_result_updated",
      });

      // =====================================
      // NEXT MAP
      // =====================================

      if (maxMaps > 1 && !seriesFinished && mapNo < maxMaps) {
        const nextMapNo = mapNo + 1;

        adminState.set(guildId, interaction.user.id, {
          ...ctx,
          mapNo: nextMapNo,
        });

        const defaults = await getDefaults(
          pool,
          guildId,
          match.event_id,
          match.id,
          maxMaps,
          nextMapNo,
        );

        const modal = buildModal(match, maxMaps, nextMapNo, defaults);

        try {
          return await interaction.showModal(modal);
        } catch {
          return interaction.reply({
            content:
              `✅ Zapisano mapę #${mapNo}. ` +
              `Aktualny wynik serii: **${finalResA}:${finalResB}**.\n` +
              `Kliknij, aby wpisać **mapę #${nextMapNo}**:`,
            ephemeral: true,

            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("match_admin_exact_open")
                  .setLabel(`➡️ ${getMapLabel(nextMapNo, match.best_of)}`)
                  .setStyle(ButtonStyle.Primary),
              ),
            ],
          });
        }
      }

      // =====================================
      // FINISHED
      // =====================================

      adminState.clear(guildId, interaction.user.id);

      if (maxMaps === 1) {
        return interaction.reply({
          content:
            `✅ Zapisano oficjalny wynik: ` +
            `**${match.team_a} ${exactA}:${exactB} ${match.team_b}**\n` +
            `⭐ Punkty zostały przeliczone.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content:
          `✅ Seria BO${match.best_of} zakończona.\n` +
          `🏆 Oficjalny wynik: **${match.team_a} ` +
          `${finalResA}:${finalResB} ${match.team_b}**\n` +
          `⭐ Punkty zostały przeliczone.`,
        ephemeral: true,
      });
    });
  } catch (err) {
    logError("matches", "matchAdminExactSubmit failed", {
      message: err.message,
      stack: err.stack,
    });

    return interaction
      .reply({
        content: "❌ Nie udało się zapisać wyników.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
