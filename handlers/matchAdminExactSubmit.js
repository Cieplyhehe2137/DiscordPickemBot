const pool = require('../db');
const adminState = require('../utils/matchAdminState');
const logger = require('../utils/logger');

module.exports = async function matchAdminExactSubmit(interaction) {
    const ctx = adminState.get(interaction.user.id);
    if (!ctx) {
        return interaction.reply({ content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.', ephemeral: true });
    }

    const aRaw = interaction.fields.getTextInputValue('exact_a');
    const bRaw = interaction.fields.getTextInputValue('exact_b');

    const exactA = Number(aRaw);
    const exactB = Number(bRaw);

    if (Number.isNaN(exactA) || Number.isNaN(exactB) || exactA < 0 || exactB < 0) {
        return interaction.reply ({ content: '❌ Wyniki muszą być liczbami >= 0.', ephemeral: true });
    }


    await pool.query(
        `
        INSERT INTO match_results (match_id, exact_a, exact_b)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE exact_a = VALUES(exact_a), exact_b = VALUES(exact_b)
        `,
        [ctx.matchId, exactA, exactB]
    );

    logger?.info?.('matches', 'Exact map score saved', { matchId: ctx.matchId, exactA, exactB, by: interaction.user.id });

    return interaction.reply({
        content: `✅ Zapisano **dokładny wynik mapy**: **${ctx.teamA} ${exactA}:${exactB} ${ctx.teamB}**`,
        ephemeral: true
    });
};