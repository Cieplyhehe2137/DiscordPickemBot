const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');

module.exports = async function matchUserExactOpen(interaction) {
    try {
        const ctx = userState.get(interaction.user.id);
        if (!ctx) {
            return interaction.reply({
                content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz (Typuj wyniki meczów).',
                ephemeral: true
            });
        }

        const [[match]] = await pool.quer(
            `SELECT id, is_locked, team_a, team_b FROM matches WHERE id=? LIMIT 1`,
            [ctx.matchId]
        );

        if (!match) {
            userState.clear(interaction.user.id);
            return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie', ephemeral: true });
        }
        if (match.is_locked) {
            return interaction.reply({ content: '🔒 Ten mecz jest zablokowany (nie można już go typować).', ephemeral: true });
        }

        let defaults = { a: '', b: '' };
        try {
            const [[p]] = await pool.query(
                `SELECT pred_exact_a, pred_exact_b FROM match_predictions WHERE match_id=? AND user_id=? LIMIT 1`,
                [ctx.matchId, interaction.user.id]
            );
            if (p) {
                defaults.a = (p.pred_exact_a ?? '') === null ? '' : String(p.pred_exact_a ?? '');
                defaults.b = (p.pred_exact_b ?? '') === null ? '' : String(p.pred_exact_b ?? '');
            }
        } catch (_) {}

        const modal = new ModalBuilder()
           .setCustomId('match_user_exact_submit')
           .setTitle(`Dokładny wynik:  ${match.team_a} vs ${match.team_b}`);

        const inA = new TextInputBuilder()
           .setCustomId('exact_a')
           .setLabel(`${match.team_a} - wynik`)
           .setStyle(TextInputStyle.Short)
           .setRequired(true)
           .setPlaceholder(`np. 13`)
           .setValue(defaults.a);

        const inB = new TextInputBuilder()
           .setCustomId('exact_b')
           .setLabel(`${match.team_b}- wynik`)
           .setStyle(TextInputStyle.Short)
           .setRequired(true)
           .setPlaceholder('np. 8')
           .setValue(defaults.b);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(inA),
            new ActionRowBuilder().addComponents(inB)
        );

        return interaction.showModal(modal);
    } catch (err) {
        logger?.error?.('matches', 'matchUserExactOpen failed', { message: err.message, stack: err.stack });
        return interaction.reply({ content: '❌ Nie udało się otworzyć modala.', ephemeral: true }).catch(() => {});
    }
};