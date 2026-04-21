import guildRegistry from "../../../utils/guildRegistry.js";

const { getAllGuildConfig } = guildRegistry;

function getAllowedGuilds() {
  const guildConfigs = getAllGuildConfig?.() || {};

  return Object.entries(guildConfigs).map(([id, cfg]) => ({
    id,
    name: cfg?.name || `Guild ${id}`,
    role: "admin",
  }));
}

function ensureDevUser(req) {
  const guilds = getAllowedGuilds();

  if (!req.session.user) {
    req.session.user = {
      id: "dev-user",
      username: "DevUser",
      avatar: null,
      guilds,
    };
  }

  if (!req.session.guildId && guilds.length > 0) {
    req.session.guildId = guilds[0].id;
  }
}

export function requireGuild(req, res, next) {
  // DEV fallback — tak jak w auth.js
  ensureDevUser(req);

  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (!req.session.guildId) {
    return res.status(400).json({ error: "No guild selected" });
  }

  const selectedGuild = req.session.user.guilds?.find(
    (g) => g.id === req.session.guildId
  );

  req.user = {
    ...req.session.user,
    guildId: req.session.guildId,
    isAdmin: !!selectedGuild,
  };

  req.guildId = req.session.guildId;

  next();
}