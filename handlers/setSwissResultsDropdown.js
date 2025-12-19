const pool = require('../db');
const resultCache = new Map();
const logger = require('../logger');
const teams = require('../teams.json');

module.exports = async (interaction) => {
  const { customId, values, user } = interaction;
  const userId = user.id;
  const username = user.username;

  const stageMatch = customId.match(/swiss_(3_0|0_3|advancing)_results_(stage\d)/);
  const confirmMatch = customId.match(/confirm_swiss_results_(stage\d)/);
  const stage = stageMatch?.[2] || confirmMatch?.[1];

  if (!stage) return interaction.reply({ content: '❌ Nie rozpoznano etapu.', ephemeral: true });

  if (!resultCache.has(stage)) resultCache.set(stage, {});
  const cache = resultCache.get(stage);

  if (interaction.isStringSelectMenu()) {
    const type = stageMatch[1];
    cache[type] = values;
    resultCache.set(stage, cache);
    
    // Szczegółowe logowanie wybranych drużyn
    logger.info(`[Swiss Results] ${username} (${userId}) wybrał ${values.length} drużyn dla ${type} w ${stage}: ${values.join(', ')}`);
    return interaction.deferUpdate();
  }

  if (interaction.isButton()) {
    const { ['3_0']: t3, ['0_3']: t0, advancing } = cache;

    if (!t3 || !t0 || !advancing) {
      return interaction.reply({ content: '❌ Wybierz wszystkie pola (3-0, 0-3, awansujące).', ephemeral: true });
    }
    
    // Walidacja unikalności drużyn między kategoriami
    const allTeams = [...t3, ...t0, ...advancing];
    const uniqueTeams = new Set(allTeams);
    
    if (allTeams.length !== uniqueTeams.size) {
      return interaction.reply({ 
        content: '⚠️ Te same drużyny nie mogą być wybrane w więcej niż jednej kategorii.', 
        ephemeral: true 
      });
    }

    try {
      // Sprawdzenie czy wszystkie wybrane drużyny są w teams.json
      const allTeams = [...t3, ...t0, ...advancing];
      const invalidTeams = allTeams.filter(team => !teams.includes(team));
      
      if (invalidTeams.length > 0) {
        return interaction.reply({ 
          content: `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}. Sprawdź poprawność nazw.`, 
          ephemeral: true 
        });
      }
      
      // Sprawdzenie czy liczba drużyn jest poprawna
      if (t3.length !== 3 || t0.length !== 3 || advancing.length !== 8) {
        return interaction.reply({ 
          content: `⚠️ Nieprawidłowa liczba drużyn: 3-0 (${t3.length}/3), 0-3 (${t0.length}/3), awansujące (${advancing.length}/8)`, 
          ephemeral: true 
        });
      }
      
      // Zapisanie wyników do bazy danych
      const [result] = await pool.query(`
        INSERT INTO swiss_results (stage, correct_3_0, correct_0_3, correct_advancing, active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE correct_3_0 = VALUES(correct_3_0), correct_0_3 = VALUES(correct_0_3),
          correct_advancing = VALUES(correct_advancing), active = 1
      `, [stage, t3.join(', '), t0.join(', '), advancing.join(', ')]);
      
      // Czyszczenie cache po zapisie
      resultCache.delete(stage);
      
      // Szczegółowe logowanie zapisanych wyników
      logger.info(`[Swiss Results] ${username} (${userId}) zapisał oficjalne wyniki dla ${stage}:`);
      logger.info(`- 3-0: ${t3.join(', ')}`);
      logger.info(`- 0-3: ${t0.join(', ')}`);
      logger.info(`- Awansujące: ${advancing.join(', ')}`);
      logger.info(`- Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);
      
      return interaction.reply({ content: '✅ Oficjalne wyniki zapisane!', ephemeral: true });
    } catch (error) {
      logger.error(`[Swiss Results] Błąd zapisu wyników dla ${stage}:`, error);
      return interaction.reply({ 
        content: '❌ Wystąpił błąd podczas zapisu wyników. Spróbuj ponownie.', 
        ephemeral: true 
      });
    }
  }
};
