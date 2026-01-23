const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const db = require('../db');
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

async function getCurrentSwiss(pool, guildId, stage) {
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
    [guildId, stage]
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
   MAIN BUILDER
======================= */

function buildSwissComponents(stage, teams, cur) {
  const left30 = Math.max(0, 2 - cur.x3_0.length);
  const left03 = Math.max(0, 2 - cur.x0_3.length);
  const leftA  = Math.max(0, 6 - cur.adv.length);

  const used = new Set(
    [...cur.x3_0, ...cur.x0_3, ...cur.adv].map(t => String(t).toLowerCase())
  );

  const baseOptions = teams
    .filter(t => !used.has(String(t).toLowerCase()))
    .map(t => ({ label: t, value: t }));

  if (baseOptions.length > 25) {
    logger.warn('interaction', 'Swiss results dropdown chunked', {
      stage,
      options: baseOptions.length
    });
  }

  const optionChunks = chunk(baseOptions, 25);
  const components = [];

  function makeSelectRows(type, left, label) {
    optionChunks.forEach((opts, idx) => {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`official_swiss_${type}:${stage}:p${idx}`)
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
        .setCustomId(`confirm_swiss_results:${stage}`)
        .setLabel('✅ Zatwierdź (dopisz)')
        .setStyle(ButtonStyle.Success)
    )
  );

  const embed = new EmbedBuilder()
    .setTitle(`📌 Oficjalne wyniki – SWISS ${stage.toUpperCase()}`)
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

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const stage = interaction.customId.split(':')[1];

  if (!stage) {
    return interaction.reply({
      content: '❌ Brak etapu Swiss (stage).',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const pool = db.getPoolForGuild(guildId);

  const teams = await loadTeamsFromDB(pool, guildId);
  const cur = await getCurrentSwiss(pool, guildId, stage);

  const { embed, components } = buildSwissComponents(stage, teams, cur);

  await interaction.editReply({
    embeds: [embed],
    components
  });
};

/* =======================
   EXPORTY
======================= */

module.exports.buildSwissComponents = buildSwissComponents;
module.exports.parseList = parseList;
module.exports.getCurrentSwiss = getCurrentSwiss;
