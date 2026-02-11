import { error } from "node:console";

export function requireGuild(req, res, next) {
    if (!req.session.guildId) {
        return res.status(400).json({ error: "No guild selected" });
    }

    req.guildId = req.session.guildId;
    next();
}