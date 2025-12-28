// handlers/panelDangerCancel.js
module.exports = async function panelDangerCancel(interaction) {
  return interaction.update({
    content: 'Anulowano.',
    components: []
  });
};
