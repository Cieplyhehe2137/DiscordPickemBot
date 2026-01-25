const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

/* =======================
   HELPERS
======================= */

function chunk(array, size = 25) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

// parse JSON / CSV / string -> array
function parseList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);

  const s = String(input).trim();
  if (!s) return [];

  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String);
  } catch (_) {}

  return s
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

async function loadTeamsFromDB(pool, guildId) {
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
  return rows.map(r => r.name);
}

async function getCurrentSwiss(pool, guildId, stageDb) {
  const [rows] = await pool.query(
    `
    SELECT correct_3_0, correct_0_3, correct_advancing
    FROM swiss_results
    WHERE guild_id = ?
      AND stage = ?
      AND active = 1
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId, stageDb]
  );

  if (!rows.length) {
    return { x3_0: [], x0_3: [], adv: [] };
  }

  return {
    x3_0: parseList(rows[0].correct_3_0),
    x0_3: parseList(rows[0].correct_0_3),
    adv:  parseList(rows[0].correct_advancing)
  };
}

/* =======================
   UI BUILDER
======================= */

function buildSwissComponents(stageLabel, stageDb, teams, cur) {
  const left30 = Math.max(0, 2 - cur.x3_0.length);
  const left03 = Math.max(0, 2 - cur.x0_3.length);
  const leftA  = Math.max(0, 6 - cur.adv.length);

  const used = new Set(
    [...cur.x3_0, ...cur.x0_3, ...cur.adv].map(t => String(t).toLowerCase())
  );

  const baseOptions = teams
    .filter(t => !used.has(String(t).toLowerCase()))
    .map(t => ({ label: t, value: t }));

  const optionChunks = chunk(baseOptions, 25);
  const components = [];

  function makeSelectRows(type, left, label) {
    optionChunks.forEach((opts, idx) => {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`official_swiss_${type}:${stageDb}:p${idx}`)
            .setPlaceholder(
              left > 0
                ? `${label} (część ${idx + 1})`
                : `${label} uzupełnione`
            )
            .setMinValues(0)
            .setMaxValues(left > 0 ? Math.min(left, opts.length) : 1)
            .setDisabled(left === 0)
            .addOptions(opts)
        )
      );
    });
  }

  makeSelectRows('3_0', left30, '3-0');
  makeSelectRows('0_3', left03, '0-3');
  makeSelectRows('advancing', leftA, 'Awans');

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_swiss_results:${stageDb}`)
        .setLabel('✅ Zatwierdź (dopisz)')
        .setStyle(ButtonStyle.Success)
    )
  );

  const embed = new EmbedBuilder()
    .setTitle(`📌 Oficjalne wyniki – SWISS ${stageLabel.toUpperCase()}`)
    .setDescription([
      'Ustawiaj wyniki **inkrementalnie**:',
      `• 🔥 3-0: ${cur.x3_0.length}/2 – ${cur.x3_0.join(', ') || '—'}`,
      `• 💀 0-3: ${cur.x0_3.length}/2 – ${cur.x0_3.join(', ') || '—'}`,
      `• 🚀 Awans: ${cur.adv.length}/6 – ${cur.adv.join(', ') || '—'}`,
      '',
      'Po wyborze kliknij **Zatwierdź (dopisz)**.'
    ].join('\n'))
    .setColor('#ff4d4d');

  return { embed, components };
}

/* =======================
   HANDLER
======================= */

module.exports = async (interaction, client, ctx = {}) => {
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  const STAGE_MAP = {
    swiss1: 'stage1',
    swiss2: 'stage2',
    swiss3: 'stage3'
  };

  let stageDb = null;
  let stageLabel = null;

  if (ctx.stage && STAGE_MAP[ctx.stage]) {
    stageDb = STAGE_MAP[ctx.stage];
    stageLabel = ctx.stage;
  }

  if (!stageDb && interaction.customId) {
    let match = interaction.customId.match(/:(stage[123])/);
    if (!match) {
      match = interaction.customId.match(/_stage([123])$/);
      if (match) match[1] = `stage${match[1]}`;
    }
    if (match) {
      stageDb = match[1];
      stageLabel = match[1];
    }
  }

  if (!stageDb) {
    logger.warn('interaction', 'Invalid Swiss stage', {
      guildId: interaction.guildId,
      ctxStage: ctx.stage,
      customId: interaction.customId
    });

    return interaction.reply({
      content: '❌ Nieprawidłowy etap Swiss.',
      ephemeral: true
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  await withGuild(interaction, async ({ pool, guildId }) => {
    const teams = await loadTeamsFromDB(pool, guildId);
    const cur = await getCurrentSwiss(pool, guildId, stageDb);

    const { embed, components } =
      buildSwissComponents(stageLabel, stageDb, teams, cur);

    await interaction.editReply({
      embeds: [embed],
      components
    });
  });
};

/* =======================
   EXPORTY (TESTY / REUSE)
======================= */

module.exports.buildSwissComponents = buildSwissComponents;
module.exports.parseList = parseList;
module.exports.getCurrentSwiss = getCurrentSwiss;
