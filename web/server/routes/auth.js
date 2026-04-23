import express from "express";

const router = express.Router();

/* ================= LOGIN ================= */

router.get("/discord", (req, res) => {
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!process.env.DISCORD_CLIENT_ID || !redirectUri) {
    console.error("❌ Missing DISCORD env variables");
    return res.status(500).send("Server config error");
  }

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  res.redirect(url);
});

/* ================= CALLBACK ================= */

router.get("/discord/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    const redirectUri = process.env.DISCORD_REDIRECT_URI;

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
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("❌ OAuth token error:", tokenData);
      return res.status(500).send("OAuth failed");
    }

    const accessToken = tokenData.access_token;

    /* ================= USER ================= */

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userRes.json();

    /* ================= GUILDS ================= */

    const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const guilds = await guildRes.json();

    const adminGuilds = Array.isArray(guilds)
      ? guilds.filter((g) => (BigInt(g.permissions) & 0x8n) === 0x8n)
      : [];

    /* ================= SESSION ================= */

    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      guilds: adminGuilds,
    };

    req.session.guildId = adminGuilds?.[0]?.id || null;

    req.session.save(() => {
      res.redirect(`${process.env.FRONTEND_URL}/guilds`);
    });

  } catch (err) {
    console.error("❌ OAuth callback error:", err);
    res.status(500).send("OAuth failed");
  }
});

/* ================= GET CURRENT USER ================= */

router.get("/me", (req, res) => {
  // console.log("HIT /api/auth/select-guild");
  // console.log("BODY:", req.body);
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json(req.session.user);
});

/* ================= SELECT GUILD ================= */

router.post("/select-guild", (req, res) => {
  // console.log("HIT /api/auth/select-guild");
  // console.log("CONTENT-TYPE:", req.headers["content-type"]);
  // console.log("BODY RAW:", req.body);
  // console.log("SESSION USER:", !!req.session.user);

  const { guildId } = req.body || {};

  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!guildId) {
    return res.status(400).json({ error: "Missing guildId" });
  }

  const userGuild = req.session.user.guilds.find((g) => g.id === guildId);

  if (!userGuild) {
    return res.status(403).json({ error: "Guild not allowed" });
  }

  req.session.guildId = guildId;

  res.json({ ok: true, guildId });
});

/* ================= CURRENT GUILD ================= */

router.get("/current-guild", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const guild = req.session.user.guilds.find(
    (g) => g.id === req.session.guildId
  );

  if (!guild) {
    return res.status(404).json({ error: "Guild not found" });
  }

  res.json(guild);
});

/* ================= LOGOUT ================= */

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect(process.env.FRONTEND_URL);
  });
});

export default router;