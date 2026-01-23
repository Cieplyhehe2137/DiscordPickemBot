// handlers/matchAddFlow.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../db');
const logger = require('../utils/logger');

const PAGE_SIZE = 24; // 24 + 1 = Next/Prev w limicie 25
const state = new Map(); // key: `${guildId}:${userId}` -> { phase, bestOf, teamA }

const stateKey = (interaction) => `${interaction.guildId || 'dm'}:${interaction.user.id}`;

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

// ✅ Teams z DB (per guild)
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

function buildCancelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('match_add_cancel')
      .setLabel('✖️ Anuluj')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildAgainRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('match_add_again')
      .setLabel('➕ Dodaj kolejny (ta sama faza/BO)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('match_add_cancel')
      .setLabel('✅ Zakończ')
      .setStyle(ButtonStyle.Success)
  );
}

function buildSetStartRow(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`match_admin_start_open:${matchId}`)
      .setLabel('🕒 Ustaw start (opcjonalnie)')
      .setStyle(ButtonStyle.Secondary)
  );
}

// === SELECT: faza ===
async function onPhaseSelect(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const phase = interaction.values?.[0];
  if (!phase) return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });

  const key = stateKey(interaction);
  state.set(key, { phase, bestOf: null, teamA: null });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_add_bo_select')
      .setPlaceholder('Wybierz BO…')
      .addOptions([
        { label: 'BO1', value: '1' },
        { label: 'BO3', value: '3' },
        { label: 'BO5', value: '5' },
      ])
  );

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${phase}**\nTeraz wybierz **BO**:`,
    components: [row, buildCancelRow()]
  });
}

// === SELECT: BO ===
async function onBoSelect(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const bo = Number(interaction.values?.[0]);
  if (![1, 3, 5].includes(bo)) return interaction.update({ content: '❌ Niepoprawne BO.', components: [] });

  const key = stateKey(interaction);
  const st = state.get(key);
  if (!st?.phase) return interaction.update({ content: '❌ Sesja wygasła. Kliknij jeszcze raz ➕ Dodaj mecz.', components: [] });

  st.bestOf = bo;
  st.teamA = null;
  state.set(key, st);

  // ✅ Teams z DB
  const teams = await loadTeamsFromDb(interaction.guildId);
  if (!teams.length) {
    return interaction.update({
      content: '❌ Brak aktywnych drużyn w bazie (Teams manager).',
      components: [buildCancelRow()]
    });
  }

  const row = buildTeamSelect({
    customId: 'match_add_team_a_select',
    placeholder: 'Wybierz Team A…',
    teams,
    page: 0,
    includePrevNext: teams.length > PAGE_SIZE
  });

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nWybierz **Team A**:`,
    components: [row, buildCancelRow()]
  });
}

// === SELECT: Team A (z paginacją) ===
async function onTeamASelect(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const key = stateKey(interaction);
  const st = state.get(key);
  if (!st?.phase || !st?.bestOf) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  const picked = interaction.values?.[0];
  if (!picked) return interaction.update({ content: '❌ Nie wybrano opcji.', components: [] });

  const [type, payload] = picked.split('|');

  const teamsAll = await loadTeamsFromDb(interaction.guildId);
  if (!teamsAll.length) {
    return interaction.update({
      content: '❌ Brak aktywnych drużyn w bazie (Teams manager).',
      components: [buildCancelRow()]
    });
  }

  if (type === 'PAGE') {
    const page = Number(payload || 0);
    const row = buildTeamSelect({
      customId: 'match_add_team_a_select',
      placeholder: 'Wybierz Team A…',
      teams: teamsAll,
      page,
      includePrevNext: teamsAll.length > PAGE_SIZE
    });
    return interaction.update({
      content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nWybierz **Team A**:`,
      components: [row, buildCancelRow()]
    });
  }

  if (type !== 'TEAM') return interaction.update({ content: '❌ Nieznana opcja.', components: [] });

  st.teamA = payload;
  state.set(key, st);

  // Team B = wszystkie oprócz Team A
  const teamsB = teamsAll.filter(t => t !== st.teamA);

  const row = buildTeamSelect({
    customId: 'match_add_team_b_select',
    placeholder: 'Wybierz Team B…',
    teams: teamsB,
    page: 0,
    includePrevNext: teamsB.length > PAGE_SIZE
  });

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nTeam A: **${st.teamA}**\nWybierz **Team B**:`,
    components: [row, buildCancelRow()]
  });
}

// === SELECT: Team B (z paginacją) + INSERT do DB ===
async function onTeamBSelect(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const key = stateKey(interaction);
  const st = state.get(key);
  if (!st?.phase || !st?.bestOf || !st?.teamA) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  const picked = interaction.values?.[0];
  if (!picked) return interaction.update({ content: '❌ Nie wybrano opcji.', components: [] });

  const [type, payload] = picked.split('|');

  const teamsAll = (await loadTeamsFromDb(interaction.guildId)).filter(t => t !== st.teamA);
  if (!teamsAll.length) {
    return interaction.update({
      content: '❌ Brak aktywnych drużyn w bazie (Teams manager).',
      components: [buildCancelRow()]
    });
  }

  if (type === 'PAGE') {
    const page = Number(payload || 0);
    const row = buildTeamSelect({
      customId: 'match_add_team_b_select',
      placeholder: 'Wybierz Team B…',
      teams: teamsAll,
      page,
      includePrevNext: teamsAll.length > PAGE_SIZE
    });
    return interaction.update({
      content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nTeam A: **${st.teamA}**\nWybierz **Team B**:`,
      components: [row, buildCancelRow()]
    });
  }

  if (type !== 'TEAM') return interaction.update({ content: '❌ Nieznana opcja.', components: [] });

  const teamB = payload;
  if (teamB === st.teamA) {
    return interaction.update({ content: '❌ Team B nie może być taki sam jak Team A.', components: [buildCancelRow()] });
  }

  // ✅ pool per-guild dla matches
  const pool = db.getPoolForGuild(interaction.guildId);

  // AUTO match_no
  const [[next]] = await pool.query(
    `SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo FROM matches WHERE guild_id = ? AND phase = ?`,
    [interaction.guildId, st.phase]
  );
  const matchNo = Number(next?.nextNo || 1);

  try {
    const [res] = await pool.query(
      `INSERT INTO matches (guild_id, phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
      [interaction.guildId, st.phase, matchNo, st.teamA, teamB, st.bestOf]
    );

    const matchId = res.insertId;

    logger.info('matches', 'Match added', {
      guildId: interaction.guildId,
      phase: st.phase,
      matchNo,
      teamA: st.teamA,
      teamB,
      bestOf: st.bestOf,
      by: interaction.user.id
    });

    return interaction.update({
      content: `✅ Dodano mecz: **${st.teamA} vs ${teamB}** (BO${st.bestOf})\nFaza: **${st.phase}**, match_no: **#${matchNo}**`,
      components: [
        buildAgainRow(),
        buildSetStartRow(matchId)
      ]
    });
  } catch (e) {
    logger.error('matches', 'Match insert failed', { message: e.message, stack: e.stack });

    const msg = (e.code === 'ER_DUP_ENTRY')
      ? '❌ Taki mecz już istnieje (duplikat).'
      : '❌ Nie udało się dodać meczu (błąd DB).';

    return interaction.update({ content: msg, components: [buildAgainRow()] });
  }
}

// === BUTTON: cancel / again ===
async function onCancel(interaction) {
  const key = stateKey(interaction);
  state.delete(key);
  return interaction.update({ content: '✅ Anulowano dodawanie meczu.', components: [] });
}

async function onAgain(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const key = stateKey(interaction);
  const st = state.get(key);
  if (!st?.phase || !st?.bestOf) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  st.teamA = null;
  state.set(key, st);

  // ✅ Teams z DB
  const teams = await loadTeamsFromDb(interaction.guildId);
  if (!teams.length) {
    return interaction.update({
      content: '❌ Brak aktywnych drużyn w bazie (Teams manager).',
      components: []
    });
  }

  const row = buildTeamSelect({
    customId: 'match_add_team_a_select',
    placeholder: 'Wybierz Team A…',
    teams,
    page: 0,
    includePrevNext: teams.length > PAGE_SIZE
  });

  return interaction.update({
    content: `➕ Dodawanie meczu — faza: **${st.phase}**, BO: **${st.bestOf}**\nWybierz **Team A**:`,
    components: [row, buildCancelRow()]
  });
}

module.exports = {
  onPhaseSelect,
  onBoSelect,
  onTeamASelect,
  onTeamBSelect,
  onCancel,
  onAgain
};
