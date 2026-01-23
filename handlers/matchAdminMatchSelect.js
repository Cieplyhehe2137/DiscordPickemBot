// handlers/matchAdminMatchSelect.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../db');
const adminState = require('../utils/matchAdminState');
const logger = require('../utils/logger');

function safeLabel(str) {
  const s = String(str || 'opcja');
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) ||
         perms?.has(PermissionFlagsBits.ManageGuild);
}

function buildScoreOptions(bestOf) {
  if (bestOf === 1) return [{ a: 1, b: 0 }, { a: 0, b: 1 }];
  if (bestOf === 3) return [
    { a: 2, b: 0 }, { a: 2, b: 1 },
    { a: 1, b: 2 }, { a: 0, b: 2 }
  ];
  return [
    { a: 3, b: 0 }, { a: 3, b: 1 }, { a: 3, b: 2 },
    { a: 2, b: 3 }, { a: 1, b: 3 }, { a: 0, b: 3 }
  ];
}

module.exports = async function matchAdminMatchSelect(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    if (!hasAdminPerms(interaction)) {
      return interaction.reply({
        content: '❌ Brak uprawnień.',
        ephemeral: true
      });
    }

    const raw = interaction.values?.[0];
    const matchId = Number(raw);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return interaction.update({
        content: '❌ Niepoprawny identyfikator meczu.',
        components: []
      });
    }

    const pool = db.getPoolForGuild(interaction.guildId);

    const [[m]] = await pool.query(
      `SELECT id, team_a, team_b, best_of
       FROM matches
       WHERE id = ? AND guild_id = ?
       LIMIT 1`,
      [matchId, interaction.guildId]
    );

    if (!m) {
      return interaction.update({
        content: '❌ Nie znaleziono meczu lub nie należy do tego serwera.',
        components: []
      });
    }

    // ✅ zapamiętaj kontekst (guild-safe)
    adminState.set(interaction.guildId, interaction.user.id, {
      matchId: m.id,
      teamA: m.team_a,
      teamB: m.team_b,
      bestOf: Number(m.best_of),
      mapNo: 1
    });

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

    const rowExact = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('match_admin_exact_open')
        .setLabel('✍️ Wpisz dokładny wynik mapy (np. 13:8)')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content:
        `🎯 Ustaw wyniki dla: **${m.team_a} vs ${m.team_b}** (BO${m.best_of})\n` +
        `• Dropdown = **wynik serii (maps)**\n` +
        `• Przycisk = **dokładny wynik mapy (rundy)**`,
      components: [rowSeries, rowExact]
    });

  } catch (err) {
    logger.error('matches', 'matchAdminMatchSelect failed', {
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Wystąpił błąd przy wyborze meczu.',
      ephemeral: true
    }).catch(() => {});
  }
};
