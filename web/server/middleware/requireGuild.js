export function requireGuild(req, res, next) {
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