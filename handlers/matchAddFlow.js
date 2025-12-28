// handlers/matchAddFlow.js
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const logger = require('../utils/logger');

const PAGE_SIZE = 24; // 24 + 1 = Next/Prev w 25 limit
const state = new Map(); // key: userId -> { phase, bestOf, teamA }

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

function loadTeams() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (typeof parsed[0] === 'string') return parsed;
      // jeśli masz obiekty { name/label/value }
      if (typeof parsed[0] === 'object') {
        return parsed.map(x => x.name || x.label || x.value).filter(Boolean);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
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
  )
}

// === SELECT: faza ===
async function onPhaseSelect(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const phase = interaction.values?.[0];
  if (!phase) return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });

  state.set(interaction.user.id, { phase, bestOf: null, teamA: null });

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

  const st = state.get(interaction.user.id);
  if (!st?.phase) return interaction.update({ content: '❌ Sesja wygasła. Kliknij jeszcze raz ➕ Dodaj mecz.', components: [] });

  st.bestOf = bo;
  st.teamA = null;
  state.set(interaction.user.id, st);

  const teams = loadTeams();
  if (!teams.length) {
    return interaction.update({ content: '❌ Brak teamów w teams.json.', components: [buildCancelRow()] });
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

  const st = state.get(interaction.user.id);
  if (!st?.phase || !st?.bestOf) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  const picked = interaction.values?.[0];
  if (!picked) return interaction.update({ content: '❌ Nie wybrano opcji.', components: [] });

  const [type, payload] = picked.split('|');

  const teamsAll = loadTeams();
  if (!teamsAll.length) return interaction.update({ content: '❌ Brak teamów w teams.json.', components: [buildCancelRow()] });

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
  state.set(interaction.user.id, st);

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

  const st = state.get(interaction.user.id);
  if (!st?.phase || !st?.bestOf || !st?.teamA) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  const picked = interaction.values?.[0];
  if (!picked) return interaction.update({ content: '❌ Nie wybrano opcji.', components: [] });

  const [type, payload] = picked.split('|');

  const teamsAll = loadTeams().filter(t => t !== st.teamA);
  if (!teamsAll.length) return interaction.update({ content: '❌ Brak teamów w teams.json.', components: [buildCancelRow()] });

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

  // AUTO match_no
  const [[next]] = await pool.query(
    `SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo FROM matches WHERE phase = ?`,
    [st.phase]
  );
  const matchNo = Number(next?.nextNo || 1);

  try {
    await pool.query(
      `INSERT INTO matches (phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked)
       VALUES (?, ?, ?, ?, ?, NULL, 0)`,
      [st.phase, matchNo, st.teamA, teamB, st.bestOf]
    );

    logger.info('matches', 'Match added', {
      phase: st.phase, matchNo, teamA: st.teamA, teamB, bestOf: st.bestOf, by: interaction.user.id
    });

    return interaction.update({
      content: `✅ Dodano mecz: **${st.teamA} vs ${teamB}** (BO${st.bestOf})\nFaza: **${st.phase}**, match_no: **#${matchNo}**`,
      components: [buildAgainRow()]
    });
  } catch (e) {
    logger.error('matches', 'Match insert failed', { message: e.message, stack: e.stack });

    // Jeśli poleci na UNIQUE (duplicate), pokaż sensowny komunikat
    const msg = (e.code === 'ER_DUP_ENTRY')
      ? '❌ Taki mecz już istnieje (duplikat).'
      : '❌ Nie udało się dodać meczu (błąd DB).';

    return interaction.update({ content: msg, components: [buildAgainRow()] });
  }
}

// === BUTTON: cancel / again ===
async function onCancel(interaction) {
  state.delete(interaction.user.id);
  return interaction.update({ content: '✅ Anulowano dodawanie meczu.', components: [] });
}

async function onAgain(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
  }

  const st = state.get(interaction.user.id);
  if (!st?.phase || !st?.bestOf) {
    return interaction.update({ content: '❌ Sesja wygasła. Kliknij ➕ Dodaj mecz.', components: [] });
  }

  st.teamA = null;
  state.set(interaction.user.id, st);

  const teams = loadTeams();
  if (!teams.length) return interaction.update({ content: '❌ Brak teamów w teams.json.', components: [] });

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
