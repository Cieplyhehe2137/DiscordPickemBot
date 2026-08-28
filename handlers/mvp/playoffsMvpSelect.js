const { withGuild } = require("../../utils/guildContext");
const { logError, logInfo } = require("../../utils/logger");

const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");

const { validateMvpSession } = require("../../utils/mvpFlowSession");

const { getOpenEventId } = require("../../utils/getOpenEventId");

// ======================================================
// HANDLER
// ======================================================

module.exports = async function playoffsMvpSelect(interaction) {
  try {
    // ==================================================
    // INTERACTION
    // ==================================================

    if (!interaction.isStringSelectMenu()) return;

    if (!interaction.customId.startsWith("playoffs_mvp_page_")) {
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user?.id;

    if (!guildId || !userId) {
      return interaction.deferUpdate().catch(() => {});
    }

    // ==================================================
    // SELECTED CANDIDATE
    // ==================================================

    const selectedCandidateId = interaction.values?.[0];

    if (!selectedCandidateId) {
      return interaction.deferUpdate().catch(() => {});
    }

    // ==================================================
    // DEFER
    // ==================================================

    await interaction.deferUpdate();

    // ==================================================
    // GUILD CONTEXT
    // ==================================================

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ==============================================
      // PHASE GUARD
      // ==============================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "PLAYOFFS",
      });

      if (!gate.allowed) {
        return interaction.followUp({
          content:
            gate.message || "❌ Typowanie MVP nie jest obecnie dostępne.",
          ephemeral: true,
        });
      }

      // ==============================================
      // CURRENT EVENT
      // ==============================================

      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.followUp({
          content: "❌ Nie znaleziono aktywnego eventu.",
          ephemeral: true,
        });
      }

      // ==============================================
      // MVP FLOW SESSION
      // ==============================================

      const sessionGate = validateMvpSession({
        guildId,
        userId,
        eventId: currentEventId,
      });

      if (!sessionGate.allowed) {
        return interaction.followUp({
          content:
            sessionGate.message ||
            "❌ Ten formularz MVP nie jest już aktualny.",
          ephemeral: true,
        });
      }

      // ==============================================
      // CANDIDATE ID
      // ==============================================

      const candidateId = Number(selectedCandidateId);

      if (!Number.isInteger(candidateId) || candidateId <= 0) {
        return interaction.followUp({
          content: "❌ Nieprawidłowy kandydat MVP.",
          ephemeral: true,
        });
      }

      // ==============================================
      // CANDIDATE VALIDATION
      // ==============================================

      const [[candidate]] = await pool.query(
        `
            SELECT
              id,
              nickname,
              team_name
            FROM mvp_candidates
            WHERE guild_id = ?
              AND id = ?
              AND is_active = 1
            LIMIT 1
            `,
        [guildId, candidateId],
      );

      if (!candidate) {
        return interaction.followUp({
          content: "❌ Ten kandydat MVP nie jest już aktywny.",
          ephemeral: true,
        });
      }

      // ==============================================
      // USERNAME
      // ==============================================

      const username =
        interaction.member?.displayName ||
        interaction.user?.globalName ||
        interaction.user?.username ||
        "Unknown";

      // ==============================================
      // SAVE
      // ==============================================

      await pool.query(
        `
          INSERT INTO mvp_predictions (
            guild_id,
            event_id,
            user_id,
            username,
            candidate_id
          )
          VALUES (?, ?, ?, ?, ?)

          ON DUPLICATE KEY UPDATE
            event_id = VALUES(event_id),
            username = VALUES(username),
            candidate_id = VALUES(candidate_id),
            updated_at = CURRENT_TIMESTAMP
          `,
        [guildId, currentEventId, userId, username, candidateId],
      );

      // ==============================================
      // LOG
      // ==============================================

      logInfo("mvp", "Playoffs MVP prediction saved", {
        guildId,
        eventId: currentEventId,
        userId,
        candidateId,
      });

      // ==============================================
      // RESPONSE
      // ==============================================

      return interaction.followUp({
        content:
          `⭐ MVP zapisany: **${candidate.nickname}**` +
          (candidate.team_name ? ` (${candidate.team_name})` : ""),
        ephemeral: true,
      });
    });
  } catch (err) {
    // ==================================================
    // ERROR
    // ==================================================

    logError("mvp", "playoffsMvpSelect failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (!interaction.deferred && !interaction.replied) {
      return interaction
        .reply({
          content: "❌ Nie udało się zapisać typu MVP.",
          ephemeral: true,
        })
        .catch(() => {});
    }

    return interaction
      .followUp({
        content: "❌ Nie udało się zapisać typu MVP.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
