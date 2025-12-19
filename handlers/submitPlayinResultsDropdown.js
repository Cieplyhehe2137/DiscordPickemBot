// handlers/submitPlayInResultsDropdown.js
const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');
const logger = require('../logger');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');

const cache = new Map(); // userId -> [teams]

async function loadTeams() {
  const p = path.join(process.cwd(), 'data', 'teams.json');
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

function cleanList(arr) {
  const seen = new Set(); const out = [];
  for (const v of arr || []) {
    const s = String(v || '').trim(); if (!s) continue;
    const key = s.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  return out;
}

async function getCurrent() {
  const [rows] = await pool.query(
    `SELECT correct_teams FROM playin_results WHERE active=1 ORDER BY id DESC LIMIT 1`
  );
  if (!rows.length || !rows[0].correct_teams) return [];
  // kolumna trzymana jako string "A, B, C"
  const str = String(rows[0].correct_teams || '');
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

async function saveOfficial(list) {
  await pool.query(`UPDATE playin_results SET active=0`);
  await pool.query(`INSERT INTO playin_results (correct_teams, active) VALUES (?, 1)`, [
    cleanList(list).join(', ')
  ]);
}

function ui(teamsOptions) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('official_playin_teams')
    .setPlaceholder('Wybierz zespoły Play-In (możesz partiami, nowy wybór zastępuje poprzedni)')
    .setMinValues(1)
    .setMaxValues(Math.min(12, Math.max(1, teamsOptions.length)))
    .addOptions(teamsOptions.slice(0, 25));
  const confirm = new ButtonBuilder()
    .setCustomId('confirm_playin_results')
    .setLabel('Zatwierdź wyniki')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('✅');
  return [
    new ActionRowBuilder().addComponents(select),
    new ActionRowBuilder().addComponents(confirm),
  ];
}

function pickOrKeepList(currentList, pickedNow, cap) {
  const src = (pickedNow && pickedNow.length) ? pickedNow : (currentList || []);
  const seen = new Set(), out = [];
  for (const v of src) {
    const s = String(v||'').trim(); if (!s) continue;
    const k = s.toLowerCase(); if (seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  if (out.length > cap) throw new Error(`Przekroczono limit ${cap} (jest ${out.length})`);
  return out;
}

module.exports = async function submitPlayInResultsDropdown(interaction) {
  try {
    // Otworzenie dropdowna (jeśli używasz przycisku otwierającego UI)
    if (interaction.isButton() && interaction.customId === 'set_results_playin') {
      const teams = await loadTeams();
      const options = teams.map(t => ({ label: t, value: t }));
      const components = ui(options);
      const current = await getCurrent();
      await interaction.reply({
        content:
          `📄 **Oficjalne wyniki – Play-In**\n` +
          `• Nowy wybór **zastępuje** poprzedni w danej sesji zatwierdzenia\n` +
          `• Kliknij **Zatwierdź wyniki**, by zapisać do bazy\n\n` +
          (current.length ? `Aktualnie zapisane: **${current.join(', ')}**` : `Brak zapisanych wyników.`),
        components,
        ephemeral: true,
      });
      return;
    }

    // Zbieranie wyborów z dropdowna
    if (interaction.isStringSelectMenu() && interaction.customId === 'official_playin_teams') {
      await interaction.deferUpdate();
      const userId = interaction.user.id;
      // nowy wybór zastępuje poprzedni cache — to celowe
      cache.set(userId, cleanList(interaction.values));
      await interaction.followUp({
        content: `✅ Tymczasowy wybór: **${cache.get(userId).join(', ')}**\nKliknij **Zatwierdź wyniki**, aby zapisać.`,
        ephemeral: true,
      });
      return;
    }

    // Zatwierdzanie wyników (partiami + zastępuj)
    if (interaction.isButton() && interaction.customId === 'confirm_playin_results') {
      const userId = interaction.user.id;
      const picked = cleanList(cache.get(userId) || []);
      const current = await getCurrent();

      let finalList;
      try {
        finalList = pickOrKeepList(current, picked, 8); // 8 slotów Play-In
      } catch (e) {
        return interaction.reply({ content:`⚠️ ${e.message}`, ephemeral:true });
      }

      // Walidacja z teams.json
      const teams = await loadTeams();
      const invalid = finalList.filter(t => !teams.includes(t));
      if (invalid.length) {
        return interaction.reply({ content:`⚠️ Nieznane drużyny: ${invalid.join(', ')}`, ephemeral:true });
      }

      await saveOfficial(finalList);
      cache.delete(userId);

      // Auto-przeliczenie
      try {
        const calculateScores = require('./calculateScores');
        await calculateScores();
        logger.info('[Play-in Results] Punkty przeliczone po aktualizacji.');
      } catch (e) {
        logger.error('[Play-in Results] Błąd przy calculateScores:', e);
      }

      await interaction.reply({
        content:
          (finalList.length < 8)
            ? `💾 Zapisano **częściowe** wyniki: **${finalList.join(', ')}**\n(Dodaj jeszcze ${8 - finalList.length}.)`
            : `✅ Zapisano **komplet** wyników Play-In:\n**${finalList.join(', ')}**`,
        ephemeral: true,
      });
      return;
    }
  } catch (err) {
    logger?.error?.('submitPlayInResultsDropdown error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: `❌ Błąd: \`${err.message}\``, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Błąd: \`${err.message}\``, ephemeral: true });
    }
  }
};
