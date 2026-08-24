const { logError } = require("../../utils/logger");
const { withGuild } = require("../../utils/guildContext");
const { buildSwissComponents } = require("./openSwissResultsDropdown");
const {
  getDraft,
  setDraft,
  clearDraft,
} = require("../../utils/predictionDraftCache");
const { loadActiveTeams } = require("../../utils/loadActiveTeams");
const { getOpenEventId } = require("../../utils/getOpenEventId");
const { getCurrentSwissResults } = require("../../utils/swissRepository");

const NAMESPACE = "swiss-results";
const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, data) => setDraft(NAMESPACE, key, data);

function extractStage(customId) {
  const parts = String(customId).split(":");
  return parts[1] || null;
}

function normalize(arr = []) {
  return Array.from(
    new Set(arr.map((v) => String(v || "").trim()).filter(Boolean)),
  );
}

function mergeWithCap(base = [], add = [], cap) {
  const merged = normalize([...base, ...add]);

  if (merged.length > cap) {
    return { ok: false, err: `Limit ${cap} (jest ${merged.length})` };
  }

  return { ok: true, merged };
}

module.exports = async function submitSwissResultsDropdown(interaction) {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
  if (!interaction.guildId) return;

  const guildId = interaction.guildId;
  const adminId = interaction.user.id;

  if (interaction.isStringSelectMenu()) {
    const stage = extractStage(interaction.customId);

    if (!stage) {
      await interaction.deferUpdate().catch(() => {});
      return;
    }

    const key = `${guildId}:${adminId}:${stage}`;
    const local = getCache(key) || { add3: [], add0: [], addA: [] };

    if (interaction.customId.startsWith("official_admin_swiss_3_0")) {
      local.add3 = normalize(interaction.values || []);
    } else if (interaction.customId.startsWith("official_admin_swiss_0_3")) {
      local.add0 = normalize(interaction.values || []);
    } else if (
      interaction.customId.startsWith("official_admin_swiss_advancing")
    ) {
      local.addA = normalize(interaction.values || []);
    }

    setCache(key, local);

    await interaction.deferUpdate().catch(() => {});
    return;
  }

  if (!interaction.customId.startsWith("confirm_official_swiss_results:"))
    return;

  await interaction.deferReply({ ephemeral: true });

  const stage = extractStage(interaction.customId);
  const key = `${guildId}:${adminId}:${stage}`;
  const sel = getCache(key);

  if (!stage) {
    return interaction.editReply({
      content: "❌ Nie udało się odczytać etapu Swiss.",
    });
  }

  if (!sel) {
    return interaction.editReply({
      content: "⚠️ Brak zapisanych wyborów albo cache wygasł.",
    });
  }

  if (!sel.add3.length && !sel.add0.length && !sel.addA.length) {
    return interaction.editReply({
      content: "⚠️ Nic nie wybrano w dropdownach.",
    });
  }

  await withGuild(interaction, async ({ pool }) => {
    const teams = await loadActiveTeams(pool, guildId);

    const eventId = await getOpenEventId(pool, guildId);

    if (!eventId) {
      return interaction.editReply({
        content: "❌ Nie znaleziono aktywnego eventu.",
      });
    }

    const current = await getCurrentSwissResults(pool, guildId, eventId, stage);

    const m3 = mergeWithCap(current.x3_0, sel.add3, 2);
    if (!m3.ok) {
      return interaction.editReply({
        content: `⚠️ 3-0: ${m3.err}`,
      });
    }

    const m0 = mergeWithCap(current.x0_3, sel.add0, 2);
    if (!m0.ok) {
      return interaction.editReply({
        content: `⚠️ 0-3: ${m0.err}`,
      });
    }

    const mA = mergeWithCap(current.adv, sel.addA, 6);
    if (!mA.ok) {
      return interaction.editReply({
        content: `⚠️ Awans: ${mA.err}`,
      });
    }

    const all = [...m3.merged, ...m0.merged, ...mA.merged];

    if (new Set(all.map((v) => v.toLowerCase())).size !== all.length) {
      return interaction.editReply({
        content: "⚠️ Drużyna nie może być w więcej niż jednej kategorii.",
      });
    }

    const validTeams = new Set(teams.map((t) => t.toLowerCase()));
    const invalid = all.filter((t) => !validTeams.has(t.toLowerCase()));

    if (invalid.length) {
      return interaction.editReply({
        content: `⚠️ Nieznane drużyny: ${invalid.join(", ")}`,
      });
    }

    try {
      await pool.query(
        `
        INSERT INTO swiss_results
          (guild_id, event_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          correct_3_0 = VALUES(correct_3_0),
          correct_0_3 = VALUES(correct_0_3),
          correct_advancing = VALUES(correct_advancing),
          active = 1
        `,
        [
          guildId,
          eventId,
          stage,
          m3.merged.join(", "),
          m0.merged.join(", "),
          mA.merged.join(", "),
        ],
      );

      clearDraft(NAMESPACE, key);

      const fresh = {
        x3_0: m3.merged,
        x0_3: m0.merged,
        adv: mA.merged,
      };

      const { embed, components } = buildSwissComponents(
        stage,
        stage,
        teams,
        fresh,
      );

      return interaction.editReply({
        content: "✅ Oficjalne wyniki Swiss zapisane.",
        embeds: [embed],
        components,
      });
    } catch (err) {
      logError("swiss_results", "DB error", {
        guildId,
        stage,
        message: err.message,
        stack: err.stack,
      });

      return interaction.editReply({
        content: "❌ Błąd zapisu wyników Swiss.",
      });
    }
  });
};
