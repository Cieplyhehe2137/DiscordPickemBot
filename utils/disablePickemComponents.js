const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

function getCustomId(component) {
  return component?.customId || component?.data?.custom_id || null;
}

/**
 * USER PICK = wszystko co:
 * - open_*
 * - confirm_*
 * - start_*
 * - submit_*
 * ALE:
 * - nie results
 * - nie panel
 * - nie admin
 */
function isUserPickComponent(customId = '') {
  if (!customId) return false;

  // ❌ nigdy nie zamykamy wyników
  if (
    customId.includes('results') ||
    customId.startsWith('set_results_')
  ) {
    return false;
  }

  // ❌ nigdy nie zamykamy paneli / admina
  if (
    customId.startsWith('panel:') ||
    customId.startsWith('match_admin_') ||
    customId.startsWith('teams:')
  ) {
    return false;
  }

  // ✅ user pick (wszystkie fazy)
  return (
    customId.startsWith('open_') ||
    customId.startsWith('confirm_') ||
    customId.startsWith('start_') ||
    customId.startsWith('submit_')
  );
}

async function disablePickemComponents(message) {
  if (!message?.components?.length) return;

  try {
    const newRows = message.components.map(row => {
      const newRow = new ActionRowBuilder();

      for (const comp of row.components) {
        const customId = getCustomId(comp);

        if (!customId || !isUserPickComponent(customId)) {
          newRow.addComponents(comp);
          continue;
        }

        if (comp.type === ComponentType.Button) {
          newRow.addComponents(
            ButtonBuilder.from(comp).setDisabled(true)
          );
          continue;
        }

        if (comp.type === ComponentType.StringSelect) {
          newRow.addComponents(
            StringSelectMenuBuilder.from(comp).setDisabled(true)
          );
          continue;
        }

        newRow.addComponents(comp);
      }

      return newRow;
    });

    await message.edit({ components: newRows });
  } catch (err) {
    console.warn('[disablePickemComponents]', err.message);
  }
}

module.exports = { disablePickemComponents };
