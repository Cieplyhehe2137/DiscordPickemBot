// handlers/matchAdminMatchSelect.js
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db');
const adminState = require('../utils/matchAdminState');

function safeLabel(str) {
  const s = String(str || 'opcja');
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

function buildScoreOptions(bestOf) {
  if (bestOf === 1) return [{ a: 1, b: 0 }, { a: 0, b: 1 }];
  if (bestOf === 3) return [{ a: 2, b: 0 }, { a: 2, b: 1 }, { a: 1, b: 2 }, { a: 0, b: 2 }];
  return [{ a: 3, b: 0 }, { a: 3, b: 1 }, { a: 3, b: 2 }, { a: 2, b: 3 }, { a: 1, b: 3 }, { a: 0, b: 3 }];
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

  // zapamiętaj kontekst dla modala "dokładny wynik"
  adminState.set(interaction.user.id, {
    matchId: Number(m.id),
    teamA: m.team_a,
    teamB: m.team_b,
    bestOf: Number(m.best_of),
  });

  // dropdown wyniku serii (maps)
  const seriesOptions = buildScoreOptions(Number(m.best_of)).map(s => ({
    label: safeLabel(`${m.team_a} ${s.a}:${s.b} ${m.team_b}`),
    value: `${m.id}|${s.a}|${s.b}`
  }));

  const rowSeries = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_admin_result_select')
      .setPlaceholder('Wybierz oficjalny wynik serii (maps)…')
      .addOptions(seriesOptions)
  );

  // przycisk do modala z dokładnym wynikiem mapy
  const rowExact = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('match_admin_exact_open')
      .setLabel('✍️ Wpisz dokładny wynik mapy (np. 13:8)')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.update({
    content: `🎯 Ustaw wyniki dla: **${m.team_a} vs ${m.team_b}** (BO${m.best_of})\n` +
             `• Dropdown = **wynik serii (maps)**\n` +
             `• Przycisk = **dokładny wynik mapy (rundy)**`,
    components: [rowSeries, rowExact]
  });
};
