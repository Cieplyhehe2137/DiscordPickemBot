const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

// parse JSON/CSV -> array
function parseList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  const s = String(input).trim();
  if (!s) return [];
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String);
  } catch (_) {}
  return s.replace(/[\[\]"]+/g, '')
          .split(/[;,]+/)
          .map(x => x.trim())
          .filter(Boolean);
}

async function getCurrentSwiss(stage) {
  const [rows] = await pool.query(
    `SELECT correct_3_0, correct_0_3, correct_advancing
     FROM swiss_results
     WHERE active=1 AND stage=? 
     ORDER BY id DESC 
     LIMIT 1`,
    [stage]
  );
  if (!rows.length) return { x3_0: [], x0_3: [], adv: [] };
  return {
    x3_0: parseList(rows[0].correct_3_0),
    x0_3: parseList(rows[0].correct_0_3),
    adv:  parseList(rows[0].correct_advancing),
  };
}

function buildSwissComponents(stage, teams, cur) {
  const left30 = Math.max(0, 2 - cur.x3_0.length);
  const left03 = Math.max(0, 2 - cur.x0_3.length);
  const leftA  = Math.max(0, 6 - cur.adv.length);

  // wyklucz już użyte drużyny (nie mogą trafić do dwóch kategorii)
  const used = new Set([...cur.x3_0, ...cur.x0_3, ...cur.adv].map(t => t.toLowerCase()));
  const options = teams
    .filter(t => !used.has(String(t).toLowerCase()))
    .map(t => ({ label: t, value: t }));

  const row30 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`official_swiss_3_0_${stage}`)
      .setPlaceholder(left30 ? `Wybierz do ${left30} do 3-0` : '3-0 uzupełnione')
      .setMinValues(left30 ? 1 : 0)
      .setMaxValues(Math.max(1, left30))
      .setDisabled(left30 === 0)
      .addOptions(options)
  );

  const row03 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`official_swiss_0_3_${stage}`)
      .setPlaceholder(left03 ? `Wybierz do ${left03} do 0-3` : '0-3 uzupełnione')
      .setMinValues(left03 ? 1 : 0)
      .setMaxValues(Math.max(1, left03))
      .setDisabled(left03 === 0)
      .addOptions(options)
  );

  const rowAdv = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`official_swiss_advancing_${stage}`)
      .setPlaceholder(leftA ? `Wybierz do ${leftA} do Awansu` : 'Awans uzupełniony')
      .setMinValues(leftA ? 1 : 0)
      .setMaxValues(Math.max(1, leftA))
      .setDisabled(leftA === 0)
      .addOptions(options)
  );

  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_swiss_results_${stage}`)
      .setLabel('✅ Zatwierdź (dopisz)')
      .setStyle(ButtonStyle.Success)
  );

  const embed = new EmbedBuilder()
    .setTitle(`📌 Oficjalne wyniki – SWISS ${stage.toUpperCase()}`)
    .setDescription([
      'Ustawiaj wyniki **inkrementalnie** (możesz wybrać kilka naraz – do limitu):',
      `• 🔥 3-0: ${cur.x3_0.length}/2 (pozostało ${left30}) – ${cur.x3_0.join(', ') || '—'}`,
      `• 💀 0-3: ${cur.x0_3.length}/2 (pozostało ${left03}) – ${cur.x0_3.join(', ') || '—'}`,
      `• 🚀 Awans: ${cur.adv.length}/6 (pozostało ${leftA}) – ${cur.adv.join(', ') || '—'}`,
      '',
      'Po wyborze kliknij **Zatwierdź (dopisz)**.'
    ].join('\n'))
    .setColor('#ff4d4d');

  return { embed, components: [row30, row03, rowAdv, confirm] };
}

module.exports = async (interaction) => {
  const stage = interaction.customId.split('_').pop(); // 'stage1'|'stage2'|'stage3'
  const teams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf8'));
  const cur = await getCurrentSwiss(stage);

  const { embed, components } = buildSwissComponents(stage, teams, cur);
  await interaction.reply({ embeds: [embed], components, ephemeral: true });
};

module.exports.buildSwissComponents = buildSwissComponents; // eksport do użycia w submit
module.exports.parseList = parseList;
module.exports.getCurrentSwiss = getCurrentSwiss;
