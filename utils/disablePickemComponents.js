const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const PICKEM_PREFIXES = [
  'swiss',
  'playin',
  'playoffs',
  'doubleelim',
  'open_doubleelim_dropdown'
];

function isPickemComponent(customId = '') {
  return PICKEM_PREFIXES.some(p => customId.startsWith(p));
}

async function disablePickemComponents(message) {
  const newRows = message.components.map(row => {
    const r = ActionRowBuilder.from(row);

    r.components = r.components.map(comp => {
      const id = comp.customId;
      if (!id) return comp;

      if (isPickemComponent(id)) {
        if (comp.type === 2) {
          return ButtonBuilder.from(comp).setDisabled(true);
        }
        if (comp.type === 3) {
          return StringSelectMenuBuilder.from(comp).setDisabled(true);
        }
      }

      return comp;
    });

    return r;
  });

  await message.edit({ components: newRows });
}

module.exports = { disablePickemComponents };
