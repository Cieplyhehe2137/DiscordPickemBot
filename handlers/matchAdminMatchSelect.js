// handlers/matchAdminMatchSelect.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const pool = require('../db');


console.log('[matchAdminMatchSelect] fired', interaction.customId, interaction.values);

function safeLabel(str) {
  const s = String(str || 'opcja');
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

function buildScoreOptions(bestOf, teamA, teamB) {
  if (bestOf === 1) {
    return [
      { a: 1, b: 0 },
      { a: 0, b: 1 },
    ];
  }
  if (bestOf === 3) {
    return [
      { a: 2, b: 0 },
      { a: 2, b: 1 },
      { a: 1, b: 2 },
      { a: 0, b: 2 },
    ];
  }
  // BO5
  return [
    { a: 3, b: 0 },
    { a: 3, b: 1 },
    { a: 3, b: 2 },
    { a: 2, b: 3 },
    { a: 1, b: 3 },
    { a: 0, b: 3 },
  ];
}

module.exports = async function matchAdminMatchSelect(interaction) {
  const matchId = interaction.values?.[0];
  if (!matchId) return interaction.deferUpdate();

  const [rows] = await pool.query(
    `SELECT id, team_a, team_b, best_of FROM matches WHERE id = ? LIMIT 1`,
    [matchId]
  );

  if (!rows.length) {
    return interaction.update({ content: '❌ Nie znaleziono meczu w bazie.', components: [] });
  }

  const m = rows[0];
  const options = buildScoreOptions(Number(m.best_of), m.team_a, m.team_b).map(s => {
    const label = `${m.team_a} ${s.a}:${s.b} ${m.team_b}`;
    return {
      label: safeLabel(label),
      value: `${m.id}|${s.a}|${s.b}`
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_admin_result_select')
      .setPlaceholder('Wybierz oficjalny wynik…')
      .addOptions(options)
  );

  return interaction.update({
    content: `🎯 Ustaw oficjalny wynik dla: **${m.team_a} vs ${m.team_b}** (BO${m.best_of})`,
    components: [row]
  });
};
