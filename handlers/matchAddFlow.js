const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');

const PAGE_SIZE = 24;
const state = new Map(); // `${guildId}:${userId}`

const stateKey = (interaction) =>
  `${interaction.guildId}:${interaction.user.id}`;

/* ======================
   GUARDS
====================== */

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

/* ======================
   DB
====================== */

async function loadTeamsFromDb(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId]
  );

  return rows.map(r => r.name).filter(Boolean);
}

/* ======================
   UI HELPERS
====================== */

function safeLabel(str) {
  const s = String(str || '');
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

function buildTeamSelect({ customId, placeholder, teams, page }) {
  const start = page * PAGE_SIZE;
  const slice = teams.slice(start, start + PAGE_SIZE);

  const options = slice.map(t => ({
    label: safeLabel(t),
    value: `TEAM|${t}`
  }));

  if (page > 0) {
    options.push({ label: '⬅️ Poprzednia', value: `PAGE|${page - 1}` });
  }
  if (start + PAGE_SIZE < teams.length) {
    options.push({ label: '➡️ Następna', value: `PAGE|${page + 1}` });
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

const buildAfterAddRow = (matchId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`match_set_time:${matchId}`)
      .setLabel('🕒 Ustaw godzinę')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('match_add_again')
      .setLabel('➕ Dodaj kolejny')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('match_add_cancel')
      .setLabel('✅ Zakończ')
      .setStyle(ButtonStyle.Success)
  );

/* ======================
   HANDLERS
====================== */

async function onPhaseSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const phase = interaction.values?.[0];
  if (!phase) return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });

  state.set(stateKey(interaction), { phase, bestOf: null, teamA: null });

  return interaction.update({
    content: `➕ Dodawanie meczu — faza **${phase}**\nWybierz **BO**:`,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('match_add_bo_select')
          .setPlaceholder('Wybierz BO…')
          .addOptions([
            { label: 'BO1', value: '1' },
            { label: 'BO3', value: '3' },
            { label: 'BO5', value: '5' }
          ])
      ),
      buildCancelRow()
    ]
  });
}

async function onBoSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const bo = Number(interaction.values?.[0]);
  const st = state.get(stateKey(interaction));
  if (!st || ![1, 3, 5].includes(bo)) {
    return interaction.update({ content: '❌ Sesja wygasła.', components: [] });
  }

  st.bestOf = bo;

  await withGuild(interaction, async ({ pool, guildId }) => {
    const teams = await loadTeamsFromDb(pool, guildId);

    if (!teams.length) {
      return interaction.update({
        content: '❌ Brak aktywnych drużyn.',
        components: [buildCancelRow()]
      });
    }

    return interaction.update({
      content: `➕ Faza **${st.phase}**, BO${bo}\nWybierz **Team A**:`,
      components: [
        buildTeamSelect({
          customId: 'match_add_team_a_select',
          placeholder: 'Wybierz Team A…',
          teams,
          page: 0
        }),
        buildCancelRow()
      ]
    });
  });
}

async function onTeamASelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const st = state.get(stateKey(interaction));
  if (!st) return interaction.update({ content: '❌ Sesja wygasła.', components: [] });

  const [type, payload] = interaction.values[0].split('|');

  await withGuild(interaction, async ({ pool, guildId }) => {
    const teams = await loadTeamsFromDb(pool, guildId);

    if (type === 'PAGE') {
      return interaction.update({
        content: `➕ Faza **${st.phase}**, BO${st.bestOf}\nWybierz **Team A**:`,
        components: [
          buildTeamSelect({
            customId: 'match_add_team_a_select',
            placeholder: 'Wybierz Team A…',
            teams,
            page: Number(payload)
          }),
          buildCancelRow()
        ]
      });
    }

    st.teamA = payload;
    const teamsB = teams.filter(t => t !== payload);

    return interaction.update({
      content: `Team A: **${payload}**\nWybierz **Team B**:`,
      components: [
        buildTeamSelect({
          customId: 'match_add_team_b_select',
          placeholder: 'Wybierz Team B…',
          teams: teamsB,
          page: 0
        }),
        buildCancelRow()
      ]
    });
  });
}

async function onTeamBSelect(interaction) {
  if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

  const st = state.get(stateKey(interaction));
  if (!st) return interaction.update({ content: '❌ Sesja wygasła.', components: [] });

  const [, teamB] = interaction.values[0].split('|');

  await withGuild(interaction, async ({ pool, guildId }) => {
    const [[next]] = await pool.query(
      `SELECT COALESCE(MAX(match_no),0)+1 AS nextNo
       FROM matches WHERE guild_id=? AND phase=?`,
      [guildId, st.phase]
    );

    const [res] = await pool.query(
      `
      INSERT INTO matches (
        guild_id, phase, match_no, team_a, team_b, best_of, is_locked
      )
      VALUES (?, ?, ?, ?, ?, ?, 0)
      `,
      [guildId, st.phase, next.nextNo, st.teamA, teamB, st.bestOf]
    );

    const matchId = res.insertId;

    state.delete(stateKey(interaction));

    logger.info('matches', 'Match added', {
      guildId,
      matchId,
      phase: st.phase,
      teamA: st.teamA,
      teamB,
      bestOf: st.bestOf
    });

    return interaction.update({
      content: `✅ Dodano mecz: **${st.teamA} vs ${teamB}** (BO${st.bestOf})`,
      components: [buildAfterAddRow(matchId)]
    });
  });
}

async function onCancel(interaction) {
  state.delete(stateKey(interaction));
  return interaction.update({ content: '✅ Anulowano.', components: [] });
}

async function onAgain(interaction) {
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
