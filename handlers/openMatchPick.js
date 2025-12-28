const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const { isMatchLocked } = require('../utils/matchLock');
const PAGE_SIZE = 24; // +1 opcja na "Następna strona"

// helper: bezpieczna odpowiedź zależnie od typu interakcji
async function respond(interaction, payload, isUpdate) {
  try {
    if (isUpdate) {
      return await interaction.update(payload);
    }

    // jeśli już defer/reply poszło, edytujemy
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }

    // jeśli jeszcze nie potwierdzone — normalny reply
    return await interaction.reply(payload);
  } catch (e) {
    // na wszelki wypadek: followUp (np. jeśli update się nie da)
    try {
      return await interaction.followUp({ ...payload, ephemeral: true });
    } catch (_) {}
  }
}

async function sendMatchList({ interaction, phaseKey, mode, page, isUpdate }) {
  const offset = page * PAGE_SIZE;

  const [rows] = await pool.query(
    `SELECT id, match_no, team_a, team_b, best_of, is_locked, start_time_utc
     FROM matches
     WHERE phase=?
     ORDER BY COALESCE(match_no, 999999), id
     LIMIT ? OFFSET ?`,
    [phaseKey, PAGE_SIZE + 1, offset]
  );

  if (!rows.length) {
    const payLoad = { content: `Brak meczów dla fazy **${phaseKey}**.`, components: [] };
    return respond(interaction, payLoad, isUpdate);
  }

  const hasNext = rows.length > PAGE_SIZE;
  const slice = rows.slice(0, PAGE_SIZE);

  const options = slice.map((m) => {
    const locked = isMatchLocked(m);
    return {
      label: `${m.match_no ? `#${m.match_no}` : ''}${m.team_a} vs ${m.team_b} (Bo${m.best_of})${locked} ? ' 🔒' : ''`
    }
  })

  if (hasNext) {
    options.push({ label: '➡️ Następna strona', value: `NEXT|${phaseKey}|${page + 1}` });
  }

  const customId = mode === 'res' ? 'match_pick_select_res' : 'match_pick_select_pred';
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Wybierz mecz...')
      .addOptions(options)
  );

  const payLoad = {
    content: mode === 'res'
      ? `🧾 Wybierz mecz, aby **wprowadzić oficjalny wynik** (faza: **${phaseKey}**)`
      : `🎯 Wybierz mecz do **wytypowania wyniku** (faza **${phaseKey}**)`,
    components: [row]
  };

  return respond(interaction, payLoad, isUpdate);
}

module.exports = async function openMatchPick(interaction) {
  try {
    // customId: match_pick:<phaseKey>
    const customId = interaction.customId || '';
    const phaseKey = customId.split(':')[1];

    if (!phaseKey) {
      // tu też zabezpieczamy — defer + editReply
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
      return interaction.editReply({ content: '❌ Brak phaseKey w CustomId', components: [] }).catch(() => {});
    }

    // NAJWAŻNIEJSZE: potwierdź interakcję od razu, żeby nie było 10062
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    // teraz już bezpiecznie ładujemy listę i robimy editReply
    await sendMatchList({ interaction, phaseKey, mode: 'pred', page: 0, isUpdate: false });
  } catch (err) {
    logger.error('matches', 'openMatchPick failed', { message: err.message, stack: err.stack });

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
      await interaction.editReply({ content: '❌ Błąd przy ładowaniu listy meczów.', components: [] }).catch(() => {});
    } catch (_) {}
  }
};

// export helper (używany przed select handler)
module.exports.sendMatchList = sendMatchList;
