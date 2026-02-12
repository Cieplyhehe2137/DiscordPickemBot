import express from "express";
import guildRegistry from "../../../utils/guildRegistry.js";
const { getGuildConfigs } = guildRegistry;


const router = express.Router();

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

    /* ===== TOKEN ===== */

    const tokenRes = await fetch(
      "https://discord.com/api/oauth2/token",
      {
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
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      return res.status(500).send("OAuth error");
    }

    req.session.access_token = tokenData.access_token;

    /* ===== USER ===== */

    const userRes = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const userData = await userRes.json();

    /* ===== GUILDS ===== */

    const guildRes = await fetch(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const guilds = await guildRes.json();

    const adminGuilds = guilds.filter(
      (g) => (BigInt(g.permissions) & 0x8n) === 0x8n
    );

    /* ===== SAVE SESSION ===== */

    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      guilds: adminGuilds,
    };

    res.redirect("http://localhost:5173/guilds");

  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth failed");
  }
});

/* ================= GET CURRENT USER ================= */

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const guildConfigs = getGuildConfigs();
  const allowedGuildIds = Object.keys(guildConfigs);

  const filteredGuilds = req.session.user.guilds.filter(g =>
    allowedGuildIds.includes(g.id)
  );

  res.json({
    id: req.session.user.id,
    username: req.session.user.username,
    avatar: req.session.user.avatar,
    guilds: filteredGuilds,
  });
});

/* ================= SELECT GUILD ================= */

router.post("/select-guild", (req, res) => {
  const { guildId } = req.body;

  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const userGuild = req.session.user.guilds.find(g => g.id === guildId);

  if (!userGuild) {
    return res.status(403).json({ error: "Guild not allowed" });
  }

  req.session.guildId = guildId;

  res.json({ ok: true });
});

router.get("/current-guild", (req, res) => {
  if (!req.session.user || !req.session.guildId) {
    return res.status(400).json({ error: "No guild selected" });
  }

  const guild = req.session.user.guilds.find(
    g => g.id === req.session.guildId
  );

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
