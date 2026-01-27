const {
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
} = require('discord.js');

function isMatchPick(customId = '') {
  return customId.startsWith('match_pick:');
}

function isResultsButton(customId = '') {
  return customId.startsWith('open_results_');
}


async function disableMatchComponents(message) {
  if (!message?.components?.length) return;

  const newRows = message.components.map(row => {
    const newRow = ActionRowBuilder.from(row);

    const newComponents = row.components.map(comp => {
      const customId = comp.customId ?? comp.data?.custom_id;

      if (
        comp.type === ComponentType.Button &&
        customId &&
        (isMatchPick(customId) || isResultsButton(customId))
      ) {
        return ButtonBuilder.from(comp).setDisabled(true);
      }

      return comp;
    });

    newRow.setComponents(newComponents);
    return newRow;
  });

  await message.edit({ components: newRows });
}

module.exports = { disableMatchComponents };
