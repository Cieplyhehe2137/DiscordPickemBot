const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

const PICKEM_PREFIXES = [
  'swiss',
  'playin',
  'playoffs',
  'doubleelim',
  'open_doubleelim',
];

function isPickemComponent(customId = '') {
  return PICKEM_PREFIXES.some(p => customId.startsWith(p));
}

function getCustomId(comp) {
  return comp.customId || comp.data?.custom_id || null;
}

async function disablePickemComponents(message) {
  if (!message?.components?.length) return;

  const newRows = message.components.map(row => {
    const newRow = new ActionRowBuilder();

    for (const comp of row.components) {
      const id = getCustomId(comp);

      // NIE pickem → zostawiamy bez zmian
      if (!id || !isPickemComponent(id)) {
        newRow.addComponents(comp);
        continue;
      }

      // BUTTON
      if (comp.type === ComponentType.Button) {
        newRow.addComponents(
          ButtonBuilder.from(comp).setDisabled(true)
        );
        continue;
      }

      // SELECT MENU
      if (comp.type === ComponentType.StringSelect) {
        newRow.addComponents(
          StringSelectMenuBuilder.from(comp).setDisabled(true)
        );
        continue;
      }

      // fallback
      newRow.addComponents(comp);
    }

    return newRow;
  });

  await message.edit({ components: newRows });
}

module.exports = { disablePickemComponents };
