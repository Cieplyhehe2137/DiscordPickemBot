const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ButtonStyle
} = require('discord.js');

function isMatchComponentByCustomId(customId = '') {
  return customId.startsWith('match_pick:');
}

function isMatchLinkButton(comp) {
  // link button nie ma customId
  return comp.type === ComponentType.Button && comp.style === ButtonStyle.Link;
}

async function disableMatchComponents(message) {
  const newRows = message.components.map(row => {
    const newRow = ActionRowBuilder.from(row);

    const newComponents = row.components.map(comp => {
      const customId = comp.customId ?? comp.data?.custom_id;

      // 🎯 CASE 1: normalny match_pick button
      if (customId && isMatchComponentByCustomId(customId)) {
        return ButtonBuilder.from(comp).setDisabled(true);
      }

      // 🎯 CASE 2: LINK BUTTON „Typuj wyniki meczów”
      if (isMatchLinkButton(comp)) {
        return ButtonBuilder.from(comp).setDisabled(true);
      }

      // reszta bez zmian
      return comp;
    });

    newRow.setComponents(newComponents);
    return newRow;
  });

  console.log(
    // '[MATCH DISABLE] applying components:',
    newRows.map(r =>
      r.components.map(c => ({
        id: c.customId,
        style: c.style,
        disabled: c.disabled
      }))
    )
  );

  await message.edit({ components: newRows });
}

module.exports = { disableMatchComponents };
