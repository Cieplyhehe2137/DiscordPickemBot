// handlers/submitDoubleElimResultsDropdown.js

const { logInfo, logWarn, logError, logger } = require('../../utils/logger');
const { PermissionFlagsBits } = require('discord.js');
const { withGuild } = require('../../utils/guildContext');
const { getDraft, setDraft, clearDraft } = require('../../utils/predictionDraftCache');
const { loadActiveTeams } = require('../../utils/loadActiveTeams');
const { getOpenEventId } = require('../../utils/getOpenEventId');
const { runInTransaction } = require('../../utils/runInTransaction');

const NAMESPACE = 'doubleelim-results';
const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, data) => setDraft(NAMESPACE, key, data);

const ID_MAP = {
  official_doubleelim_upper_final_a: 'upper_final_a',
  official_doubleelim_lower_final_a: 'lower_final_a',
  official_doubleelim_upper_final_b: 'upper_final_b',
  official_doubleelim_lower_final_b: 'lower_final_b',
};

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    // ===== guards =====
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '⛔ Tylko administracja może ustawiać oficjalne wyniki.',
        ephemeral: true
      });
    }

    const adminId = interaction.user.id;
    const cacheKey = `${interaction.guildId}:${adminId}`;

    let selection = getCache(cacheKey);
    if (!selection) {
      selection = {
        upper_final_a: [],
        lower_final_a: [],
        upper_final_b: [],
        lower_final_b: [],
      };
      setCache(cacheKey, selection);
    }

    // ===============================
    // SELECT – wybór drużyn
    // ===============================
    if (interaction.isStringSelectMenu() && ID_MAP[interaction.customId]) {
      const key = ID_MAP[interaction.customId];
      const values = Array.from(new Set((interaction.values || []).map(String)));

      if (values.length > 2) {
        return interaction.reply({
          content: '⚠️ Możesz wybrać maksymalnie **2** drużyny.',
          ephemeral: true
        });
      }

      selection[key] = values;
      setCache(cacheKey, selection);

      logger.debug('doubleelim_results', 'slot updated', {
        guildId: interaction.guildId,
        adminId,
        key,
        values
      });

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
      }
      return;
    }

    // ===============================
    // BUTTON – zatwierdzenie wyników
    // ===============================
    if (!interaction.isButton() || interaction.customId !== 'confirm_official_doubleelim') return;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const teams = await loadActiveTeams(pool, guildId);
      const isKnown = (t) => teams.includes(t);

      const {
        upper_final_a = [],
        lower_final_a = [],
        upper_final_b = [],
        lower_final_b = []
      } = selection;

      const all = [
        ...upper_final_a,
        ...lower_final_a,
        ...upper_final_b,
        ...lower_final_b
      ];

      if (!all.length) {
        return interaction.editReply('⚠️ Nie wybrano żadnych drużyn.');
      }

      if (new Set(all).size !== all.length) {
        return interaction.editReply(
          '⚠️ Te same drużyny nie mogą wystąpić w więcej niż jednym slocie.'
        );
      }

      const invalid = all.filter(t => !isKnown(t));
      if (invalid.length) {
        return interaction.editReply(
          `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
        );
      }

      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply(
          '❌ Nie znaleziono aktywnego eventu.'
        );
      }

      try {
        await runInTransaction(pool, async (conn) => {
          await conn.query(
            `UPDATE doubleelim_results
SET active = 0
WHERE guild_id = ?
  AND event_id = ?
  AND active = 1`,
            [guildId, eventId]
          );

          await conn.query(
            `INSERT INTO doubleelim_results
   (
     guild_id,
     event_id,
     upper_final_a,
     lower_final_a,
     upper_final_b,
     lower_final_b,
     active,
     created_at
   )
   VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
              guildId,
              eventId,
              upper_final_a.join(', ') || null,
              lower_final_a.join(', ') || null,
              upper_final_b.join(', ') || null,
              lower_final_b.join(', ') || null,
            ]
          );
        });

        clearDraft(NAMESPACE, cacheKey);

        logInfo('doubleelim_results', 'official results saved', {
          guildId,
          adminId
        });

        const mk = (arr) => arr.length ? arr.join(', ') : '—';

        return interaction.editReply(
          `✅ Zapisano oficjalne wyniki Double Elimination:\n` +
          `UFA: ${mk(upper_final_a)} | LFA: ${mk(lower_final_a)}\n` +
          `UFB: ${mk(upper_final_b)} | LFB: ${mk(lower_final_b)}`
        );
      } catch (e) {
        logError('doubleelim_results', 'DB error', {
          guildId,
          adminId,
          message: e.message,
          stack: e.stack
        });
        return interaction.editReply(`❌ Błąd zapisu wyników.`);
      }
    });

  } catch (err) {
    logError('doubleelim_results', 'top-level error', {
      message: err.message,
      stack: err.stack
    });
  }
};
