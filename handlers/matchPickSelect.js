const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const { scoreOptionsForBo } = require('../utils/scoreOptions');
const { sendMatchList } = require('./openMatchPick');
const userState = require('../utils/matchUserState');

module.exports = async function matchPickSelect(interaction) {
    try {
        const mode = interaction.customId === 'match_pick_select_res' ? 'res' : 'pred';
        const picked = interaction.values?.[0];
        if (!picked) return interaction.update({ content: '❌ Nie wybrano opcji', components: [] });

        const [type, phaseKey, third] = picked.split('|');

        if (type === 'NEXT') {
            const nextPage = Number(third || 0);
            return sendMatchList({ interaction, phaseKey, mode, page: nextPage, isUpdate: true });
        }

        if (type !== 'MATCH') {
            return interaction.update({ content: '❌ Nieznana opcja', components: [] });
        }

        const matchId = Number(third);

        const [[match]] = await pool.query(
            `SELECT id, team_a, team_b, best_of, is_locked
            FROM matches
            WHERE id=? AND phase=?
            LIMIT 1`,
            [matchId, phaseKey]
        );

        if (!match) {
            return interaction.update({ content: '❌ Nie znaleziono meczu.', components: [] });
        }
        if (mode === 'pred' && match.is_locked) {
            return interaction.update({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', components: [] });
        }

        const options = scoreOptionsForBo(match.best_of, match.team_a, match.team_b);
        if (!options.length) {
            return interaction.update({ content: '❌ Nieobsługiwany format BO w tym meczu', components: [] });
        }

        // value: MATCHID|A:B
        const scoreOptions = options.map(o => ({ label: o.label, value: `${match.id}|${o.value}` }));

        const scoreCustomId = mode === 'res' ? 'match_score_select_res' : 'match_score_select_pred';

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(scoreCustomId)
                .setPlaceholder(mode === 'res' ? 'Wybierz oficjalny wynik...' : 'Wybierz swój typ...')
                .addOptions(scoreOptions)
        );

        // dla userów: dodatkowy przycisk do wpisania dokładnego wyniku (np. 13:8)
        let extraRows = [];
        if (mode === 'pred') {
            userState.set(interaction.user.id, {
                matchId: match.id,
                teamA: match.team_a,
                teamB: match.team_b,
                bestOf: match.best_of,
                phase: phaseKey
            });

            extraRows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('match_user_exact_open')
                        .setLabel('🧮 Wpisz dokładny wynik')
                        .setStyle(ButtonStyle.Secondary)
                )
            ];
        }

        return interaction.update({
            content: mode === 'res'
                ? `🧾 Ustaw oficjalny wynik: **${match.team_a} vs ${match.team_b}** (Bo${match.best_of})`
                : `🎯 Typujesz mecz: **${match.team_a} vs ${match.team_b}** (Bo${match.best_of})`,
            components: [row, ...extraRows]
        });
    } catch (err) {
        logger.error('matches', 'matchPickSelect failed', { message: err.message, stack: err.stack });
        return interaction.update({ content: '❌ Błąd w wyborze meczu.', components: [] }).catch(() => { });
    }
}
