// utils/discord/safeReply.js
//
// Wrappers around interaction.reply/deferReply/editReply that check
// interaction.deferred/replied first, so handlers don't have to repeat the
// same "already acknowledged?" branch (Discord throws InteractionAlreadyReplied
// otherwise).

async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

async function safeDeferReply(interaction, options = {}) {
  if (interaction.deferred || interaction.replied) return;
  return interaction.deferReply(options);
}

async function safeEditReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = { safeReply, safeDeferReply, safeEditReply };
