const { logError } = require("../../utils/logger");
const userState = require("../../utils/matchUserState");
const { isMatchLocked } = require("../../utils/matchLock");
const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");
const { withGuild } = require("../../utils/guildContext");
const { maxMapsFromBo } = require("../../utils/mapLabels");
const { getMatchById } = require("../../utils/matchesStore");

module.exports = async function matchScoreSelectPred(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.update({
        content: "❌ Brak kontekstu serwera.",
        components: [],
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const picked = interaction.values?.[0];

      if (!picked) {
        return interaction.update({
          content: "❌ Nie wybrano typu.",
          components: [],
        });
      }

      const [guildIdFromValue, matchIdRaw, scoreRaw] = picked.split("|");

      if (guildIdFromValue !== guildId) {
        return interaction.update({
          content: "❌ Błędny kontekst serwera.",
          components: [],
        });
      }

      const matchId = Number(matchIdRaw);
      const [winAraw, winBraw] = String(scoreRaw || "").split(":");
      const winA = Number(winAraw);
      const winB = Number(winBraw);

      if (
        !Number.isInteger(matchId) ||
        matchId <= 0 ||
        !Number.isInteger(winA) ||
        !Number.isInteger(winB) ||
        winA < 0 ||
        winB < 0 ||
        winA === winB
      ) {
        return interaction.update({
          content: "❌ Niepoprawna wartość typu.",
          components: [],
        });
      }

      const match = await getMatchById(pool, guildId, matchId);

      if (!match) {
        return interaction.update({
          content: "❌ Nie znaleziono meczu.",
          components: [],
        });
      }

      if (!match.event_id) {
        return interaction.update({
          content: "❌ Ten mecz nie ma przypisanego eventu.",
          components: [],
        });
      }

      if (isMatchLocked(match)) {
        return interaction.update({
          content: "🔒 Ten mecz jest zablokowany (nie można już typować).",
          components: [],
        });
      }

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "MATCHES",
      });

      if (!gate.allowed) {
        return interaction.update({
          content: gate.message || "❌ Typowanie jest aktualnie zamknięte.",
          components: [],
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);
      const requiredMaps = Math.min(winA + winB, maxMaps);

      if (requiredMaps <= 0) {
        return interaction.update({
          content: "❌ Niepoprawna liczba map.",
          components: [],
        });
      }

      userState.set(guildId, interaction.user.id, {
        matchId: match.id,
        teamA: match.team_a,
        teamB: match.team_b,
        bestOf: match.best_of,
        phase: match.phase,
        mapNo: 1,
        requiredMaps,
        targetWinsA: winA,
        targetWinsB: winB,
        mapWinsA: 0,
        mapWinsB: 0,
      });

      return interaction.update({
        content:
          `🎯 Typujesz: **${match.team_a} ${winA}:${winB} ${match.team_b}** (BO${match.best_of})\n` +
          `📋 Teraz musisz kliknąć **🧮 Wpisz dokładny wynik** — bez tego typ nie zostanie zapisany.`,
        components: interaction.message.components,
      });
    });
  } catch (err) {
    logError("matches", "matchScoreSelectPred failed", {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack,
    });

    return interaction
      .update({
        content: "❌ Błąd przy wyborze typu.",
        components: [],
      })
      .catch(() => {});
  }
};
