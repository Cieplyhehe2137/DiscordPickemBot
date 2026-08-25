// interactionRouter.js
const { logInfo, logWarn, logError } = require("./utils/logger");
const { withGuild } = require("./utils/guildContext.js");

async function safeDeferUpdate(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferUpdate();
  } catch (_) {}
}

function resolveHandler(handlers, handlerName) {
  let fn = handlers?.[handlerName];

  if (fn && typeof fn === "object") {
    fn = fn[handlerName] || fn.execute || fn.run || fn.handler || fn.default;
  }

  if (typeof fn !== "function") {
    try {
      const mod = require(`./handlers/${handlerName}`);
      fn =
        (typeof mod === "function" && mod) ||
        (mod &&
          typeof mod === "object" &&
          (mod[handlerName] ||
            mod.execute ||
            mod.run ||
            mod.handler ||
            mod.default)) ||
        null;
    } catch (_) {
      fn = null;
    }
  }

  return typeof fn === "function" ? fn : null;
}

async function _handleInteraction(
  interaction,
  client,
  handlers = {},
  maps = {},
) {
  if (!interaction.guildId) {
    logWarn("INTERACTION_WITHOUT_GUILD_BLOCKED", {
      userId: interaction.user?.id || null,
      customId: interaction.customId || null,
      extra: { type: interaction.type },
    });
    return;
  }

  const {
    buttonMap = {},
    modalMap = {},
    selectMap = {},
    dropdownMap = {},
  } = maps;

  try {
    logInfo("INTERACTION_RECEIVED", {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      command: interaction.commandName || null,
      customId: interaction.customId || null,
      extra: { type: interaction.type },
    });

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logWarn("SLASH_COMMAND_NOT_FOUND", {
          guildId: interaction.guildId,
          userId: interaction.user?.id || null,
          command: interaction.commandName,
        });
        return;
      }

      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      let customId = interaction.customId;

      if (customId.startsWith("ranking:")) {
        const rankingCmd = require("./commands/ranking.js");
        return rankingCmd.handleComponent(interaction);
      }

      if (customId.startsWith("ranking_")) {
        const handler = require("./handlers/admin/rankingPagination");
        return handler(interaction, client);
      }

      if (
        customId.startsWith("playoffs_mvp_prev_") ||
        customId.startsWith("playoffs_mvp_next_")
      ) {
        const handler = require("./handlers/mvp/playoffsMvpPagination");
        return handler(interaction, client);
      }

      if (customId.startsWith("match_admin_page:")) {
        const handler = require("./handlers/matches/matchAdminPhaseSelect");
        return handler(interaction, client);
      }

      if (customId === "clear_user_picks") customId = "clear_db_confirm";
      if (customId === "full_reset") customId = "clear_db_with_results";
      if (customId === "clear_official_results")
        customId = "clear_only_results_confirm";

      if (dropdownMap?.[customId]) {
        const nameOrFile = dropdownMap[customId];
        const fn =
          handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      const prefixKey = Object.keys(buttonMap).find((key) =>
        customId.startsWith(key),
      );

      let handlerName =
        buttonMap[customId] ||
        (prefixKey && buttonMap[prefixKey]) ||
        (customId?.startsWith("confirm_end_pickem") && "confirmEndPickem") ||
        (customId?.startsWith("confirm_stage") && "submitSwissDropdown");

      if (!handlerName && customId?.startsWith("clear_")) {
        logWarn("FALLBACK_CLEAR_DATABASE_HANDLER", {
          guildId: interaction.guildId,
          userId: interaction.user?.id || null,
          customId,
        });

        handlerName = "clearDatabaseHandler";
      }

      const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

      if (!fn) {
        logWarn("UNHANDLED_BUTTON", {
          guildId: interaction.guildId,
          userId: interaction.user?.id || null,
          customId,
          extra: { handlerName },
        });

        await safeDeferUpdate(interaction);
        return;
      }

      if (customId === "export_ranking") {
        try {
          await fn(interaction, client);
        } catch (err) {
          logError("EXPORT_RANKING_FAILED", err, {
            guildId: interaction.guildId,
            userId: interaction.user?.id || null,
            customId,
          });

          const payload = {
            content: "❌ Wystąpił błąd podczas generowania pliku.",
            ephemeral: true,
          };

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(payload);
          } else {
            await interaction.followUp(payload);
          }
        }
        return;
      }

      await fn(interaction, client);
      return;
    }

    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      let handlerName =
        modalMap?.[customId] ||
        modalMap?.[customId.split(":")[0]] ||
        modalMap?.[customId.split(":").slice(0, 3).join(":")] ||
        modalMap?.[
          Object.keys(modalMap || {}).find((key) => customId.startsWith(key))
        ];

      const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

      if (!fn) {
        logWarn("UNHANDLED_MODAL", {
          guildId: interaction.guildId,
          userId: interaction.user?.id || null,
          customId,
        });
        return;
      }

      await fn(interaction, client);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId.startsWith("ranking:")) {
        const rankingCmd = require("./commands/ranking.js");
        return rankingCmd.handleComponent(interaction);
      }

      const selectKey = selectMap?.[customId]
        ? customId
        : Object.keys(selectMap || {}).find((key) => customId.startsWith(key));

      if (selectKey) {
        const handlerName = selectMap[selectKey];
        const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

        if (!fn) {
          logError("SELECT_HANDLER_NOT_CALLABLE", null, {
            guildId: interaction.guildId,
            userId: interaction.user?.id || null,
            customId,
            extra: { selectKey, handlerName },
          });

          await safeDeferUpdate(interaction);
          return;
        }

        return fn(interaction, client, handlers, maps);
      }

      const baseId = customId.replace(/_p\d+$/i, "");
      const dropdownKey =
        dropdownMap?.[customId] ||
        dropdownMap?.[baseId] ||
        Object.keys(dropdownMap || {}).find((k) => customId.startsWith(k)) ||
        Object.keys(dropdownMap || {}).find((k) => baseId.startsWith(k));

      if (dropdownKey) {
        const nameOrFile = dropdownMap[dropdownKey];
        const fn =
          handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);

        if (typeof fn !== "function") {
          logError("DROPDOWN_HANDLER_NOT_CALLABLE", null, {
            guildId: interaction.guildId,
            userId: interaction.user?.id || null,
            customId,
            extra: { dropdownKey, nameOrFile },
          });

          await safeDeferUpdate(interaction);
          return;
        }

        return fn(interaction, client);
      }

      logWarn("UNHANDLED_SELECT_MENU", {
        guildId: interaction.guildId,
        userId: interaction.user?.id || null,
        customId,
        extra: { values: interaction.values },
      });

      await safeDeferUpdate(interaction);
      return;
    }
  } catch (err) {
    logError("INTERACTION_ROUTER_ERROR", err, {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      command: interaction.commandName || null,
      customId: interaction.customId || null,
    });

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Wystąpił błąd podczas obsługi interakcji.",
          ephemeral: true,
        });
      } catch (_) {}
    }
  }
}

async function handleInteraction(
  interaction,
  client,
  handlers = {},
  maps = {},
) {
  if (!interaction.guildId) {
    logWarn("BLOCKED_INTERACTION_WITHOUT_GUILD", {
      userId: interaction.user?.id || null,
      customId: interaction.customId || null,
      extra: { type: interaction.type },
    });
    return;
  }

  return withGuild(interaction.guildId, async () =>
    _handleInteraction(interaction, client, handlers, maps),
  );
}

module.exports = handleInteraction;
