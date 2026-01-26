const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');

function isMatchComponent(customId = '') {
  return customId.startsWith('match_pick:');
}

async function disableMatchComponents(message) {
  const newRows = message.components.map(row => {
    const newRow = ActionRowBuilder.from(row);

    const newComponents = row.components.map(comp => {
      const customId = comp.customId ?? comp.data?.custom_id;
      if (!customId) return comp;

      if (!isMatchComponent(customId)) return comp;

      // ✅ BUTTON
      if (comp.type === ComponentType.Button) {
        return ButtonBuilder.from(comp).setDisabled(true);
      }

      // ✅ SELECT
      if (comp.type === ComponentType.StringSelect) {
        return StringSelectMenuBuilder.from(comp).setDisabled(true);
      }

      return comp;
    });

    newRow.setComponents(newComponents);
    return newRow;
  });

  console.log(
    '[MATCH DISABLE] applying components:',
    newRows.map(r =>
      r.components.map(c => ({
        id: c.customId,
        disabled: c.disabled
      }))
    )
  );

  await message.edit({ components: newRows });
}

module.exports = { disableMatchComponents };
