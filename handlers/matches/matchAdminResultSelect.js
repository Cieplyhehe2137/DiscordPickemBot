const { logInfo, logError } = require("../../utils/logger");
const { withGuild } = require("../../utils/guildContext");
const recalculateMatchPoints = require("../../services/recalculateMatchPoints");
const { getMatchById } = require("../../utils/matchesStore");
const { runInTransaction } = require("../../utils/runInTransaction");

module.exports = async function matchAdminResultSelect(interaction) {
  const picked = interaction.values?.[0];
  if (!picked) return interaction.deferUpdate();

  const [matchIdStr, resAStr, resBStr] = picked.split("|");
  const matchId = Number(matchIdStr);
  const resA = Number(resAStr);
  const resB = Number(resBStr);

  if (
    !interaction.guildId ||
    !Number.isInteger(matchId) ||
    !Number.isInteger(resA) ||
    !Number.isInteger(resB)
  ) {
    return interaction.update({
      content: "❌ Niepoprawne dane wyniku.",
      components: [],
    });
  }

  try {
    await withGuild(interaction, async ({ pool, guildId }) => {
      let outcome = null;

      await runInTransaction(pool, async (conn) => {
        const match = await getMatchById(conn, guildId, matchId);

        if (!match) {
          outcome = {
            content: "❌ Ten mecz nie istnieje lub nie należy do tego serwera.",
            components: [],
          };
          return;
        }

        const eventId = match.event_id;

        if (!eventId) {
          outcome = {
            content: "❌ Ten mecz nie ma przypisanego event_id.",
            components: [],
          };
          return;
        }

        await conn.query(
          `
          INSERT INTO match_results
            (guild_id, event_id, match_id, res_a, res_b)
          VALUES
            (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            event_id = VALUES(event_id),
            res_a = VALUES(res_a),
            res_b = VALUES(res_b)
          `,
          [guildId, eventId, matchId, resA, resB],
        );

        await recalculateMatchPoints(
          conn,
          guildId,
          eventId,
          matchId,
          match.best_of,
        );

        logInfo("matches", "Match result set", {
          guildId,
          eventId,
          matchId,
          resA,
          resB,
          by: interaction.user.id,
        });

        outcome = {
          content:
            `✅ Ustawiono wynik meczu **#${matchId}**: **${resA}:${resB}**\n` +
            `📊 Punkty zostały przeliczone.`,
          components: [],
        };
      });

      return interaction.update(outcome);
    });
  } catch (err) {
    logError("matches", "matchAdminResultSelect failed", {
      guildId: interaction.guildId,
      matchId,
      message: err.message,
      stack: err.stack,
    });

    return interaction.update({
      content: "❌ Błąd podczas zapisu wyniku meczu.",
      components: [],
    });
  }
};
