// handlers/matchAdminExactSubmit.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

async function getDefaults(pool, guildId, matchId, maxMaps, mapNo) {
  if (maxMaps === 1) {
    const [[r]] = await pool.query(
      `SELECT exact_a, exact_b FROM match_results WHERE guild_id = ? AND match_id = ? LIMIT 1`,
      [guildId, matchId]
    );
    return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
  }

  const [[r]] = await pool.query(
    `SELECT exact_a, exact_b
     FROM match_map_results
     WHERE guild_id = ?
     AND match_id= ? AND map_no= ? LIMIT 1`,
    [guildId, matchId, mapNo]
  );
  return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
}

function buildModal(match, maxMaps, mapNo, defaults) {
  const modal = new ModalBuilder()
    .setCustomId('match_admin_exact_submit')
    .setTitle(maxMaps === 1 ? `Oficjalny wynik` : `Oficjalny wynik — mapa #${mapNo}`);

  const inA = new TextInputBuilder()
    .setCustomId('exact_a')
    .setLabel(`${match.team_a} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('np. 13')
    .setValue(defaults.a === '' ? '' : String(defaults.a));

  const inB = new TextInputBuilder()
    .setCustomId('exact_b')
    .setLabel(`${match.team_b} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('np. 8')
    .setValue(defaults.b === '' ? '' : String(defaults.b));

  modal.addComponents(
    new ActionRowBuilder().addComponents(inA),
    new ActionRowBuilder().addComponents(inB)
  );

  return modal;
}

module.exports = async function matchAdminExactSubmit(interaction) {
  const pool = db.getPoolForGuild(interaction.guildId);
  try {
    const ctx = adminState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) return interaction.reply({ content: '❌ Brak kontekstu meczu.', ephemeral: true });

    const exactA = Number(interaction.fields.getTextInputValue('exact_a'));
    const exactB = Number(interaction.fields.getTextInputValue('exact_b'));
    if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
      return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of FROM matches WHERE id=? AND guild_id = ? LIMIT 1`,
      [ctx.matchId, interaction.guildId]
    );
    if (!match) return interaction.reply({ content: '❌ Mecz nie istnieje.', ephemeral: true });

    const maxMaps = maxMapsFromBo(match.best_of);

    let mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 1);
    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) mapNo = 1;

    if (maxMaps === 1) {
      // BO1 – zapis do match_results
      await pool.query(
        `INSERT INTO match_results (guild_id, match_id, res_a, res_b, exact_a, exact_b)
         VALUES (?, ?, NULL, NULL, ?, ?)
         ON DUPLICATE KEY UPDATE exact_a=VALUES(exact_a), exact_b=VALUES(exact_b)`,
        [interaction.guildId, match.id, exactA, exactB]
      );
    } else {
      // BO3/BO5 – zapis per mapa
      await pool.query(
        `INSERT INTO match_map_results (guild_id, match_id, map_no, exact_a, exact_b)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE exact_a=VALUES(exact_a), exact_b=VALUES(exact_b), updated_at=CURRENT_TIMESTAMP`,
        [interaction.guildId, match.id, mapNo, exactA, exactB]
      );
    }

    // Następna mapa -> od razu modal
    // Następna mapa -> próbuj od razu modal (fallback: przycisk "Dalej")
    if (maxMaps > 1 && mapNo < maxMaps) {
      const nextMapNo = mapNo + 1;
      adminState.set(interaction.guildId, interaction.user.id, { ...ctx, mapNo: nextMapNo });

      const defaults = await getDefaults(pool, interaction.guildId, match.id, maxMaps, nextMapNo);
      const modal = buildModal(match, maxMaps, nextMapNo, defaults);

      try {
        return await interaction.showModal(modal);
      } catch (e) {
        // fallback: jak Discord nie pozwoli otworzyć kolejnego modala po submit, daj 1 klik
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        return interaction.reply({
          content: `✅ Zapisano mapę #${mapNo}. Kliknij, aby wpisać **mapę #${nextMapNo}**:`,
          ephemeral: true,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('match_admin_exact_open_next') // musisz mieć handler
                .setLabel(`➡️ Mapa #${nextMapNo}`)
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });
      }
    }


    // Koniec
    if (maxMaps > 1) adminState.set(interaction.guildId, interaction.user.id, { ...ctx, mapNo: 1 });

    return interaction.reply({
      content:
        maxMaps === 1
          ? `✅ Zapisano oficjalny dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`
          : `✅ Zapisano oficjalne dokładne wyniki dla BO${match.best_of} (mapy 1–${maxMaps}).`,
      ephemeral: true
    });
  } catch (err) {
    logger?.error?.('matches', 'matchAdminExactSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać.', ephemeral: true }).catch(() => { });
  }
};
