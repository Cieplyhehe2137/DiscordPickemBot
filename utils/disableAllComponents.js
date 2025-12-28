// utils/disableAllComponents.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

function disableAllComponents(message) {
  const rows = message.components || [];
  const newRows = rows.map((row) => {
    const rb = ActionRowBuilder.from(row);

    rb.components = row.components.map((c) => {
      try {
        switch (c.type) {
          case ComponentType.Button:
            return ButtonBuilder.from(c).setDisabled(true);

          case ComponentType.StringSelect:
            return StringSelectMenuBuilder.from(c).setDisabled(true);

          case ComponentType.UserSelect:
            return UserSelectMenuBuilder.from(c).setDisabled(true);

          case ComponentType.RoleSelect:
            return RoleSelectMenuBuilder.from(c).setDisabled(true);

          case ComponentType.MentionableSelect:
            return MentionableSelectMenuBuilder.from(c).setDisabled(true);

          case ComponentType.ChannelSelect:
            return ChannelSelectMenuBuilder.from(c).setDisabled(true);

          default:
            return c; // zostaw jak jest
        }
      } catch (_) {
        return c; // jak coś dziwnego, nie wywalaj całej edycji
      }
    });

    return rb;
  });

  return newRows;
}

module.exports = { disableAllComponents };
