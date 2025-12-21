// handlers/matchAdminPhaseSelect.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');

function safeLabel(str) {
  if (!str) return 'mecz';
  const s = String(str);
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

module.exports = async function matchAdminPhaseSelect(interaction) {
  const phase = interaction.values?.[0];
  if (!phase) return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });

  try {
    const [rows] = await pool.query(
      `
      SELECT
        m.id, m.phase, m.match_no, m.team_a, m.team_b, m.best_of,
        r.res_a, r.res_b
      FROM matches m
      LEFT JOIN match_results r ON r.match_id = m.id
      WHERE m.phase = ?
      ORDER BY COALESCE(m.match_no, 999999) ASC, m.id ASC
      `,
      [phase]
    );

    if (!rows.length) {
      return interaction.update({
        content: `ℹ️ Brak meczów w bazie dla fazy **${phase}**.\nDodaj je przyciskiem **➕ Dodaj mecz** w panelu.`,
        components: []
      });
    }

    // Discord limit: 25 opcji na select => pokaż max 25 (na start)
    const options = rows.slice(0, 25).map(m => {
      const score = (m.res_a === null || m.res_b === null) ? '—' : `${m.res_a}:${m.res_b}`;
      const label = `#${m.match_no ?? '?'} ${m.team_a} vs ${m.team_b} (BO${m.best_of}) [${score}]`;
      return {
        label: safeLabel(label),
        value: String(m.id),
        description: 'Wybierz, aby ustawić wynik'
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`match_admin_match_select:${phase}`) // phase w customId, żeby nie zgubić kontekstu
        .setPlaceholder('Wybierz mecz do ustawienia wyniku…')
        .addOptions(options)
    );

    return interaction.update({
      content: `🎯 **Wyniki meczów** — faza: **${phase}**\nWybierz mecz:`,
      components: [row]
    });
  } catch (e) {
    logger?.error?.('matches', 'matchAdminPhaseSelect failed', { message: e.message, stack: e.stack });
    return interaction.update({ content: '❌ Błąd przy pobieraniu meczów z bazy.', components: [] });
  }
};
