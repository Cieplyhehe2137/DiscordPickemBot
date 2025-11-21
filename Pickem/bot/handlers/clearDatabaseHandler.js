// handlers/clearDatabaseHandler.js
const pool = require('../db.js');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

module.exports = async (interaction) => {
  // Akceptujemy tylko BUTTON
  if (!interaction.isButton()) return;

  // 1) BŁYSKAWICZNE potwierdzenie, żeby nie wygasł token interakcji (3s)
  //    -> po tym używamy wyłącznie followUp()/edytowania wiadomości kanałowych
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
  } catch (_) {
    // jeśli już było potwierdzone gdzieś indziej, ignorujemy
  }

  // 2) Mapowanie aliasów (bez nadpisywania interaction.customId)
  const aliasMap = {
    clear_user_picks: 'clear_db_confirm',
    full_reset: 'clear_db_with_results',
    clear_official_results: 'clear_only_results_confirm',
  };
  const rawId = interaction.customId || '';
  const action = aliasMap[rawId] || rawId;

  // Helper do bezpiecznych followUp (po deferUpdate)
  async function safeFollowUp(payload) {
    try {
      return await interaction.followUp({ ephemeral: true, ...payload });
    } catch (e) {
      // fallback jeśli coś poszło nie tak
      try { return await interaction.followUp({ ephemeral: true, content: '❌ Wystąpił błąd.' }); } catch (_) {}
    }
  }

  // === CONFIRMY ===
  if (action === 'clear_db_confirm') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('clear_db_yes').setLabel('✅ Tak, wyczyść').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('clear_db_no').setLabel('❌ Nie, anuluj').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setTitle('🗑 Czy na pewno chcesz wyczyścić bazę?')
      .setDescription('Ta operacja usunie **wszystkie typy użytkowników** z bazy!')
      .setColor(0xffcc00);

    return safeFollowUp({ embeds: [embed], components: [row] });
  }

  if (action === 'clear_db_with_results') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('clear_all_yes').setLabel('✅ Tak, wyczyść WSZYSTKO').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('clear_all_no').setLabel('❌ Nie, anuluj').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Pełny reset bazy danych')
      .setDescription('Ta operacja usunie **WSZYSTKO**, włącznie z oficjalnymi wynikami.')
      .setColor(0xff0000);

    return safeFollowUp({ embeds: [embed], components: [row] });
  }

  if (action === 'clear_only_results_confirm') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('clear_only_results_yes').setLabel('✅ Tak, usuń oficjalne wyniki').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('clear_only_results_no').setLabel('❌ Nie, anuluj').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setTitle('🗑 Usunąć oficjalne wyniki?')
      .setDescription('Typy użytkowników **pozostaną** — usuniemy tylko oficjalne wyniki wprowadzone przez admina.')
      .setColor(0xff8800);

    return safeFollowUp({ embeds: [embed], components: [row] });
  }

  // === AKCJE KASUJĄCE ===
  if (action === 'clear_db_yes') {
    try {
      await pool.query(`DELETE FROM swiss_predictions`);
      await pool.query(`DELETE FROM playoffs_predictions`);
      await pool.query(`DELETE FROM doubleelim_predictions`);
      await pool.query(`DELETE FROM playin_predictions`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle('🧹 Wyczyszczono bazę danych')
            .setDescription('Usunięto **wszystkie typy użytkowników**.')
        ]
      });

      // log kanał
      if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff4444)
                .setTitle('🧹 Baza wyczyszczona')
                .setDescription(`${interaction.user} wyczyścił wszystkie typy użytkowników`)
            ]
          });
        }
      }
    } catch (err) {
      await safeFollowUp({ content: '❌ Błąd podczas czyszczenia typów.' });
    }
    return;
  }

  if (action === 'clear_all_yes') {
    try {
      await pool.query(`DELETE FROM swiss_predictions`);
      await pool.query(`DELETE FROM playoffs_predictions`);
      await pool.query(`DELETE FROM doubleelim_predictions`);
      await pool.query(`DELETE FROM playin_predictions`);
      await pool.query(`DELETE FROM active_panels`);
      await pool.query(`DELETE FROM swiss_results`);
      await pool.query(`DELETE FROM playoffs_results`);
      await pool.query(`DELETE FROM doubleelim_results`);
      await pool.query(`DELETE FROM playin_results`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🧹 Pełny reset bazy danych')
            .setDescription('Usunięto **typy użytkowników** oraz **oficjalne wyniki**.')
        ]
      });

      if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🧹 PEŁNY RESET BAZY')
                .setDescription(`${interaction.user} wyczyścił całą bazę danych wraz z oficjalnymi wynikami`)
            ]
          });
        }
      }
    } catch (err) {
      await safeFollowUp({ content: '❌ Błąd podczas pełnego resetu bazy.' });
    }
    return;
  }

  if (action === 'clear_only_results_yes') {
    try {
      await pool.query(`DELETE FROM swiss_results`);
      await pool.query(`DELETE FROM playoffs_results`);
      await pool.query(`DELETE FROM doubleelim_results`);
      await pool.query(`DELETE FROM playin_results`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('🧹 Usunięto oficjalne wyniki')
            .setDescription('Typy użytkowników **pozostały bez zmian**.')
        ]
      });

      if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff4444)
                .setTitle('🧹 Usunięto oficjalne wyniki')
                .setDescription(`${interaction.user} wyczyścił oficjalne wyniki we wszystkich fazach`)
            ]
          });
        }
      }
    } catch (err) {
      await safeFollowUp({ content: '❌ Błąd podczas usuwania oficjalnych wyników.' });
    }
    return;
  }

  // === Anulacje ===
  if (action === 'clear_db_no' || action === 'clear_all_no' || action === 'clear_only_results_no') {
    // Po deferUpdate() nic nie trzeba zwracać; można dać krótką informację:
    return safeFollowUp({ content: '✅ Anulowano.' });
  }

  // Inne / nieznane
  return; // brak akcji
};
