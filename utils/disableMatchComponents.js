const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

function isMatchComponent(customId = '') {
  return (
    customId.startsWith('match_') ||
    customId.startsWith('matches_') ||
    customId.startsWith('match:') ||
    customId.startsWith('open_match_')
  );
}

async function disableMatchComponents(message) {
  const newRows = message.components.map(row => {
    const r = ActionRowBuilder.from(row);

    r.components = r.components.map(comp => {
      const id = comp.customId;
      if (!id) return comp;

      if (isMatchComponent(id)) {
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

  console.log('[MATCH DISABLE] applying components:', 
    newRows.map(r => r.components.map(c => ({
      id: c.data?.custom_id,
      disabled: c.data?.disabled
    })))
  );

  await message.edit({
    embeds: message.embeds,
    components: newRows
  });
}

module.exports = { disableMatchComponents };
