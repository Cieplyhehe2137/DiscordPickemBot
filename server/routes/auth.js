// Logowanie przez Discorda i sesja uzytkownika.
//
// Pierwsza grupa tras wyciagnieta z app.js. Trasy zostaja rejestrowane na
// `app`, a nie przez express.Router, i to jest decyzja swiadoma: router
// zmienilby ksztalt tablicy tras (trafily by do wlasnego stosu zamiast na
// najwyzszy poziom), a wlasnie porownanie tej tablicy - npm run routes - jest
// jedynym dowodem, ze rozbijanie 12-tysiecznego pliku niczego nie gubi.
// Router bedzie mial sens, gdy serwer bedzie mial testy dotykajace zapytan.
//
// Zaleznosci przychodza argumentem zamiast importem, zeby modul nie wiedzial,
// skad biora sie pula i konfiguracja - dzieki temu da sie go kiedys wywolac
// w tescie z atrapami.

export function registerAuthRoutes(
  app,
  { pool, guildRegistry, isProduction, webOrigin, administratorPermission },
) {
  app.get("/api/auth/me", (req, res) => {
    res.json({
      user: req.session?.user || null,
    });
  });

  app.get("/api/auth/discord", (req, res) => {
    console.log("[AUTH] Discord login start");

    req.session.returnTo = req.query.returnTo || "/public";

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session save failed");
      }

      const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds",
      });

      const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

      console.log("[AUTH] returnTo query:", req.query.returnTo);
      console.log("[AUTH] returnTo saved:", req.session.returnTo);

      res.redirect(url);
    });
  });

  app.get("/api/auth/discord/callback", async (req, res) => {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).send("Missing code");
      }

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Discord token error:", tokenData);
        return res.status(401).send("Discord OAuth failed");
      }

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const discordUser = await userResponse.json();

      if (!userResponse.ok) {
        console.error("Discord user error:", discordUser);
        return res.status(401).send("Discord user fetch failed");
      }

      // Needed to know which guilds the user can administer (used by hasAdminPermission/isGuildMember).
      const guildsResponse = await fetch(
        "https://discord.com/api/users/@me/guilds",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      const discordGuilds = guildsResponse.ok ? await guildsResponse.json() : [];

      if (!guildsResponse.ok) {
        console.error(
          "Discord guilds fetch failed:",
          await guildsResponse.text().catch(() => ""),
        );
      }

      req.session.user = {
        id: discordUser.id,
        username: discordUser.username,
        global_name: discordUser.global_name,
        avatar: discordUser.avatar,
        guilds: Array.isArray(discordGuilds)
          ? discordGuilds.map((g) => ({
            id: g.id,
            name: g.name,
            permissions: g.permissions,
          }))
          : [],
      };

      await pool.query(
        `
    INSERT INTO user_profiles (
      user_id,
      username,
      displayname,
      avatar
    )
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      username = VALUES(username),
      displayname = VALUES(displayname),
      avatar = VALUES(avatar),
      updated_at = CURRENT_TIMESTAMP
    `,
        [
          discordUser.id,
          discordUser.username,
          discordUser.global_name || discordUser.username,
          discordUser.avatar,
        ],
      );

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Session save failed");
        }

        const returnTo = req.session.returnTo || "/public";
        delete req.session.returnTo;

        res.redirect(`${webOrigin}${returnTo}`);
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("OAuth callback failed");
    }
  });

  if (!isProduction) {
    // Dev-only login shortcut. Never enable in production - it logs anyone in as a real Discord account with no credentials.
    app.get("/api/auth/dev-login", (req, res) => {
      req.session.user = {
        id: "461851082570596352",
        username: "cieplyhehe",
        global_name: "cieplyhehe",
        avatar: null,
        guilds: guildRegistry.getAllGuildIds().map((id) => ({
          id,
          name: id,
          permissions: String(administratorPermission),
        })),
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Session save failed");
        }

        res.redirect(`${webOrigin}/public`);
      });
    });
  }

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({
        ok: true,
      });
    });
  });
}
