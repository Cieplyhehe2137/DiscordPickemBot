// handlers/dangerCancel.js
module.exports = async function dangerCancel(interaction) {
  // to jest odpowiedź na update selecta (tam był update), więc tu też update
  return interaction.update({
    content: 'Anulowano.',
    components: []
  });
};
