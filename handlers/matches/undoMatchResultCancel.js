module.exports = async function undoMatchResultCancel(
  interaction
) {
  if (
    interaction.customId !==
    'undo_match_result_cancel'
  ) {
    return;
  }

  return interaction.update({
    content:
      '❌ Cofnięcie wyniku anulowane.',
    embeds: [],
    components: []
  });
};