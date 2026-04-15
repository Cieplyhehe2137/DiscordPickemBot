console.log("AUTH ROUTES LOADED - NEW FILE");
import express from "express";
import guildRegistry from "../../../utils/guildRegistry.js";

const { getAllGuildConfig } = guildRegistry;
const router = express.Router();

/* ================= HELPERS ================= */

function getAllowedGuilds() {
  const guildConfigs = getAllGuildConfig?.() || {};

  return Object.entries(guildConfigs).map(([id, cfg]) => ({
    id,
    name: cfg?.name || `Guild ${id}`,
    role: "admin",
  }));
}

function getDevUser(req) {
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

  return req.session.user;
}

/* ================= LOGIN ================= */

router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
  });

  res.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );
});

/* ================= CALLBACK ================= */

router.get("/discord/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Brak code");
    }

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      return res.status(500).send("OAuth error");
    }

    req.session.access_token = tokenData.access_token;

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userRes.json();

    const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const guilds = await guildRes.json();

    const adminGuilds = Array.isArray(guilds)
      ? guilds.filter((g) => (BigInt(g.permissions) & 0x8n) === 0x8n)
      : [];

    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      guilds: adminGuilds,
    };

    if (!req.session.guildId && adminGuilds.length > 0) {
      req.session.guildId = adminGuilds[0].id;
    }

    req.session.save(() => {
      res.redirect("http://localhost:5173/guilds");
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth failed");
  }
});

/* ================= GET CURRENT USER ================= */

router.get("/me", (req, res) => {
  console.log("HIT /api/auth/me - NEW DEV ROUTE");
  const user = req.session.user || getDevUser(req);
  const allowedGuilds = getAllowedGuilds();
  const allowedGuildIds = allowedGuilds.map((g) => g.id);

  const filteredGuilds = (user.guilds || []).filter((g) =>
    allowedGuildIds.includes(g.id)
  );

  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    guilds: filteredGuilds,
  });
});

/* ================= SELECT GUILD ================= */

router.post("/select-guild", (req, res) => {
  const user = req.session.user || getDevUser(req);
  const { guildId } = req.body || {};

  if (!guildId) {
    return res.status(400).json({ error: "Missing guildId" });
  }

  const allowedGuilds = getAllowedGuilds();
  const userGuild =
    (user.guilds || []).find((g) => g.id === guildId) ||
    allowedGuilds.find((g) => g.id === guildId);

  if (!userGuild) {
    return res.status(403).json({ error: "Guild not allowed" });
  }

  req.session.guildId = guildId;

  res.json({ ok: true, guildId });
});

/* ================= CURRENT GUILD ================= */

router.get("/current-guild", (req, res) => {
  const user = req.session.user || getDevUser(req);
  const allowedGuilds = getAllowedGuilds();

  if (!req.session.guildId) {
    if (allowedGuilds.length === 0) {
      return res.status(404).json({ error: "No guilds configured" });
    }

    req.session.guildId = allowedGuilds[0].id;
  }

  const guild =
    (user.guilds || []).find((g) => g.id === req.session.guildId) ||
    allowedGuilds.find((g) => g.id === req.session.guildId);

  if (!guild) {
    return res.status(404).json({ error: "Guild not found" });
  }

  res.json(guild);
});

/* ================= LOGOUT ================= */

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("http://localhost:5173");
  });
});

export default router;