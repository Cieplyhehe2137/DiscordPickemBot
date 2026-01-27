const {
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
} = require('discord.js');

function isMatchPick(customId = '') {
  return customId.startsWith('match_pick:');
}

function isResultsButton(customId = '') {
  return customId === 'open_results_matches';
}

async function disableMatchComponents(message) {
  if (!message) {
    console.log('[DISABLE][MATCH] message = null');
    return;
  }

  if (!Array.isArray(message.components)) {
    console.log('[DISABLE][MATCH] message.components invalid:', message.components);
    return;
  }

  console.log('\n[DISABLE][MATCH] MESSAGE ID:', message.id);
  console.log('[DISABLE][MATCH] ROWS COUNT:', message.components.length);

  const newRows = message.components.map((row, rowIndex) => {
    console.log(`\n[DISABLE][MATCH] ROW ${rowIndex}`);

    const newRow = new ActionRowBuilder();

    row.components.forEach((comp, compIndex) => {
      const customId = comp.customId ?? comp.data?.custom_id ?? null;

      console.log('  ├─ component', {
        index: compIndex,
        type: comp.type,
        style: comp.style,
        customId,
        disabled_before: comp.disabled,
      });

      // CASE 1: match pick
      if (
        comp.type === ComponentType.Button &&
        customId &&
        isMatchPick(customId)
      ) {
        console.log('  │  ↳ DISABLING MATCH PICK');

        newRow.addComponents(
          ButtonBuilder.from(comp).setDisabled(true)
        );
        return;
      }

      // CASE 2: results button
      if (
        comp.type === ComponentType.Button &&
        customId &&
        isResultsButton(customId)
      ) {
        console.log('  │  ↳ DISABLING RESULTS BUTTON');

        newRow.addComponents(
          ButtonBuilder.from(comp).setDisabled(true)
        );
        return;
      }

      console.log('  │  ↳ LEAVING AS IS');
      newRow.addComponents(comp);
    });

    console.log(
      '[DISABLE][MATCH] NEW ROW:',
      newRow.components.map(c => ({
        id: c.customId,
        disabled: c.disabled,
        style: c.style,
      }))
    );

    return newRow;
  });

  console.log('\n[DISABLE][MATCH] EDITING MESSAGE…');

  try {
    await message.edit({ components: newRows });
    console.log('[DISABLE][MATCH] MESSAGE EDITED OK');
  } catch (err) {
    console.error('[DISABLE][MATCH] MESSAGE EDIT FAILED:', err);
  }
}

module.exports = { disableMatchComponents };
