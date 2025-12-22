// handlers/matchUserExactSubmit.js
const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');

module.exports = async function matchUserExactSubmit(interaction) {
    try {
        const ctx = userState.get(interaction.user.id);
        if (!ctx) {
            return interaction.reply({
                content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz (Typuj wyniki meczów).',
                ephemeral: true
            });
        }

        const aRaw = interaction.fields.getTextInputValue('exact_a');
        const bRaw = interaction.fields.getTextInputValue('exact_b');

        const exactA = Number(aRaw);
        const exactB = Number(bRaw);

        if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
            return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
        }

        const [[match]] = await pool.query(
            `SELECT id, is_locked, team_a, team_b FROM matches WHERE id=? LIMIT 1`,
            [ctx.matchId]
        );

        if (!match) {
            userState.clear(interaction.user.id);
            return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie.', ephemeral: true });
        }
        if (match.is_locked) {
            return interaction.reply({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', ephemeral: true });
        }

        // UWAGA: wymaga kolumn pred_exact_a / pred_exact_b w tabeli match_predictions
        await pool.query(
            `INSERT INTO match_predictions (match_id, user_id, pred_exact_a, pred_exact_b)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pred_exact_a=VALUES(pred_exact_a), pred_exact_b=VALUES(pred_exact_b), updated_at=CURRENT_TIMESTAMP`,
            [ctx.matchId, interaction.user.id, exactA, exactB]
        );

        logger?.info?.('matches', 'User exact prediction saved', { matchId: ctx.matchId, userId: interaction.user.id, exactA, exactB });

        return interaction.reply({
            content: `✅ Zapisano dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`,
            ephemeral: true
        });
    } catch (err) {
        logger?.error?.('matches', 'matchUserExactSubmit failed', { message: err.message, stack: err.stack });

        if (String(err?.message || '').includes('Unknown column')) {
            return interaction.reply({
                content: '❌ Brakuje kolumn w DB (pred_exact_a/pred_exact_b). Zrób migrację DB z instrukcji.',
                ephemeral: true
            }).catch(() => { });
        }

        return interaction.reply({ content: '❌ Nie udało się zapisać wyniku.', ephemeral: true }).catch(() => { });
    }
};
