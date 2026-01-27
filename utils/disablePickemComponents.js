const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

/**
 * Każdy komponent Pick'Em MUSI zawierać jedną z tych fraz w customId.
 * Nie opieramy się na prefixach – tylko na semantyce.
 */
const PICKEM_KEYWORDS = [
  'swiss',
  'playin',
  'playoffs',
  'doubleelim',
];

/**
 * Bezpieczne pobranie customId
 */
function getCustomId(component) {
  return (
    component?.customId ||
    component?.data?.custom_id ||
    null
  );
}

/**
 * Czy komponent należy do Pick'Em
 */
/**
 * Buttony USER TYPOWANIA – TYLKO TE ZAMYKAMY
 */
function isUserPredictionComponent(customId = '') {
  return (
    // PLAY-IN
    customId === 'open_playin_dropdown' ||
    customId === 'confirm_playin' ||

    // SWISS
    customId.startsWith('start_swiss_stage') ||
    customId.startsWith('confirm_stage') ||
    customId.startsWith('submit_swiss') ||

    // PLAYOFFS
    customId === 'open_playoffs_dropdown' ||
    customId === 'confirm_playoffs' ||

    // DOUBLE ELIM
    customId === 'open_doubleelim_dropdown' ||
    customId === 'confirm_doubleelim'
  );
}


/**
 * Główna funkcja – dezaktywuje TYLKO komponenty Pick'Em
 * i zostawia resztę UI nietkniętą.
 */
async function disablePickemComponents(message) {
  if (!message || !Array.isArray(message.components)) return;

  try {
    const newRows = message.components.map(row => {
      const newRow = new ActionRowBuilder();

      for (const component of row.components) {
        const customId = getCustomId(component);

        // NIE pickem → przepisujemy 1:1
        if (!customId || !isUserPredictionComponent(customId)) {
          newRow.addComponents(component);
          continue;
        }

        // BUTTON
        if (component.type === ComponentType.Button) {
          newRow.addComponents(
            ButtonBuilder.from(component).setDisabled(true)
          );
          continue;
        }

        // STRING SELECT
        if (component.type === ComponentType.StringSelect) {
          newRow.addComponents(
            StringSelectMenuBuilder.from(component).setDisabled(true)
          );
          continue;
        }

        // fallback – nieznany komponent
        newRow.addComponents(component);
      }

      return newRow;
    });

    await message.edit({ components: newRows });
  } catch (err) {
    // NIE crashujemy bota – log i cisza
    console.warn('[disablePickemComponents] failed:', err.message);
  }
}

module.exports = {
  disablePickemComponents,
};
