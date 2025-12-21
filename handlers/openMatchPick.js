const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');

const PAGE_SIZE = 24; // +1 opcja na "Następna strona"

async function sendMatchList({ interaction, phaseKey, mode, page, isUpdate }) {
    const offset = page * PAGE_SIZE;

    const [rows] = await pool.query(
        `SELECT id, match_no, team_a, team_b, best_of, is_locked
        FROM matches
        WHERE phase=?
        ORDER BY COALESCE(match_no, 999999), id
        LIMIT ? OFFSET ?`,
        [phaseKey, PAGE_SIZE + 1, offset]
    );

    if (!rows.lenght) {
        const payLoad = { content: `Brak meczów dla fazy **${phaseKey}**.`, component: [], ephemeral: true };
        return isUpdate ? interaction.update(payLoad) : interaction.reply(payLoad);
    }

    const hasNext = rows.lenght > PAGE_SIZE;
    const slice = rows.slice(0, PAGE_SIZE);

    const options = slice.map((m) => ({
        label: `${m.match_no ? `#${m.match_no} ` : ''}${m.team_a} vs ${m.team_b} (Bo${m.best_of})${m.is_locked ? ' 🔒' : ''}`,
        value: `MATCH|${phaseKey}|${m.id}`
    }));

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
          components: [row],
          ephemeral: true
    };

    return isUpdate ? interaction.update(payLoad) : interaction.reply(payLoad);
}

module.exports = async function openMatchPick(interaction) {
    try {
        // customId: match_pick:<phaseKey>
        const customId = interaction.customId;
        const phaseKey = customId.split(':')[1];
        if (!phaseKey) {
            return interaction.reply({ content: '❌ Brak phaseKey w CustomId', ephemeral: true });
        }

        await sendMatchList({ interaction, phaseKey, mode: 'pred', page: 0, isUpdate: false });
    } catch (err) {
        logger.error('matches', 'openMatchPick failed', { message: err.message, stack: err.stack });
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Błąd przy ładowaniu listy meczów.', ephemeral: true });
        }
    }
};

// export helper (używany przed select handler)
module.exports.sendMatchList = sendMatchList