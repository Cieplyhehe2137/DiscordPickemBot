const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../db');
const logger = require('../utils/logger');

const PAGE_SIZE = 24;
const state = new Map(); // key: `${guildId}:${userId}` -> { phase, bestOf, teamA }

const stateKey = (interaction) => `${interaction.guildId}:${interaction.user.id}`;

// ===== GUARDS =====
function requireGuild(interaction) {
  if (!interaction.guildId) {
    interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    }).catch(() => {});
    return false;
  }
  return true;
}

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) ||
         perms?.has(PermissionFlagsBits.ManageGuild);
}

// ===== DB =====
async function loadTeamsFromDb(guildId) {
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY sort_order ASC, name ASC`,
    [guildId]
  );
  return rows.map(r => r.name).filter(Boolean);
}

// ===== UI HELPERS =====
function safeLabel(str) {
  if (!str) return 'team';
  const s = String(str);
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

function buildTeamSelect({ customId, placeholder, teams, page, includePrevNext }) {
  const start = page * PAGE_SIZE;
  const slice = teams.slice(start, start + PAGE_SIZE);
  const options = slice.map(t => ({ label: safeLabel(t), value: `TEAM|${t}` }));

  if (includePrevNext) {
    if (page > 0) options.push({ label: '⬅️ Poprzednia strona', value: `PAGE|${page - 1}` });
    if (start + PAGE_SIZE < teams.length) options.push({ label: '➡️ Następna strona', value: `PAGE|${page + 1}` });
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options)
  );
}

const buildCancelRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('match_add_cancel')
      .setLabel('✖️ Anuluj')
      .setStyle(ButtonStyle.Secondary)
  );

const buildAgainRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('match_add_again')
      .setLabel('➕ Dodaj kolejny (ta sama faza/BO)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('match_add_cancel')
      .setLabel('✅ Zakończ')
      .setStyle(ButtonStyle.Success)
  );

const buildSetStartRow = (matchId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`match_admin_start_open:${matchId}`)
      .setLabel('🕒 Ustaw start (opcjonalnie)')
      .setStyle(ButtonStyle.Secondary)
  );

// ===== HANDLERS =====
async function onPhaseSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const phase = interaction.values?.[0];
  if (!phase) return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });

  state.set(stateKey(interaction), { phase, bestOf: null, teamA: null });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_add_bo_select')
      .setPlaceholder('Wybierz BO…')
      .addOptions([
        { label: 'BO1', value: '1' },
        { label: 'BO3', value: '3' },
        { label: 'BO5', value: '5' }
      ])
  );

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${phase}**\nTeraz wybierz **BO**:`,
    components: [row, buildCancelRow()]
  });
}

async function onBoSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const bo = Number(interaction.values?.[0]);
  if (![1, 3, 5].includes(bo)) {
    return interaction.update({ content: '❌ Niepoprawne BO.', components: [] });
  }

  const st = state.get(stateKey(interaction));
  if (!st?.phase) {
    return interaction.update({ content: '❌ Sesja wygasła.', components: [] });
  }

  st.bestOf = bo;
  st.teamA = null;

  const teams = await loadTeamsFromDb(interaction.guildId);
  if (!teams.length) {
    return interaction.update({
      content: '❌ Brak aktywnych drużyn w bazie.',
      components: [buildCancelRow()]
    });
  }

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${bo}**\nWybierz **Team A**:`,
    components: [
      buildTeamSelect({
        customId: 'match_add_team_a_select',
        placeholder: 'Wybierz Team A…',
        teams,
        page: 0,
        includePrevNext: teams.length > PAGE_SIZE
      }),
      buildCancelRow()
    ]
  });
}

async function onTeamASelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const st = state.get(stateKey(interaction));
  if (!st?.phase || !st?.bestOf) {
    return interaction.update({ content: '❌ Sesja wygasła.', components: [] });
  }

  const [type, payload] = interaction.values[0].split('|');
  const teamsAll = await loadTeamsFromDb(interaction.guildId);

  if (type === 'PAGE') {
    return interaction.update({
      content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nWybierz **Team A**:`,
      components: [
        buildTeamSelect({
          customId: 'match_add_team_a_select',
          placeholder: 'Wybierz Team A…',
          teams: teamsAll,
          page: Number(payload),
          includePrevNext: teamsAll.length > PAGE_SIZE
        }),
        buildCancelRow()
      ]
    });
  }

  st.teamA = payload;
  state.set(stateKey(interaction), st);

  const teamsB = teamsAll.filter(t => t !== payload);

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nTeam A: **${payload}**\nWybierz **Team B**:`,
    components: [
      buildTeamSelect({
        customId: 'match_add_team_b_select',
        placeholder: 'Wybierz Team B…',
        teams: teamsB,
        page: 0,
        includePrevNext: teamsB.length > PAGE_SIZE
      }),
      buildCancelRow()
    ]
  });
}

async function onTeamBSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const key = stateKey(interaction);
  const st = state.get(key);
  if (!st?.phase || !st?.bestOf || !st?.teamA) {
    return interaction.update({ content: '❌ Sesja wygasła.', components: [] });
  }

  const [, teamB] = interaction.values[0].split('|');
  const pool = db.getPoolForGuild(interaction.guildId);

  const [[next]] = await pool.query(
    `SELECT COALESCE(MAX(match_no),0)+1 AS nextNo
     FROM matches WHERE guild_id=? AND phase=?`,
    [interaction.guildId, st.phase]
  );

  const [res] = await pool.query(
    `INSERT INTO matches (guild_id, phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
    [interaction.guildId, st.phase, next.nextNo, st.teamA, teamB, st.bestOf]
  );

  state.delete(key); // ✅ cleanup

  logger.info('matches', 'Match added', {
    guildId: interaction.guildId,
    phase: st.phase,
    teamA: st.teamA,
    teamB,
    bestOf: st.bestOf
  });

  return interaction.update({
    content: `✅ Dodano mecz: **${st.teamA} vs ${teamB}** (BO${st.bestOf})`,
    components: [buildAgainRow(), buildSetStartRow(res.insertId)]
  });
}

async function onCancel(interaction) {
  state.delete(stateKey(interaction));
  return interaction.update({ content: '✅ Anulowano dodawanie meczu.', components: [] });
}

async function onAgain(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;
  return onPhaseSelect(interaction);
}

module.exports = {
  onPhaseSelect,
  onBoSelect,
  onTeamASelect,
  onTeamBSelect,
  onCancel,
  onAgain
};
