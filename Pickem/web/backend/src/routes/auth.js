console.log("ŁADUJĘ AUTH.JS Z:", import.meta.url);
console.log("REDIRECT URI:", process.env.DISCORD_REDIRECT_URI);
console.log("ENV URI RAW:", JSON.stringify(process.env.DISCORD_REDIRECT_URI));

import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import dotenv from "dotenv";
import { verifyJWT } from "../middleware/auth.js";
dotenv.config();

const router = express.Router();

// ===============================================
//  /auth/discord — START LOGOWANIA
// ===============================================
router.get("/discord", (req, res) => {
  console.log("🔥 [AUTH] WEJŚCIE DO /auth/discord");

  const redirect =
    `https://discord.com/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.DISCORD_CLIENT_ID}` +
    `&scope=identify` +
    `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}`;

  console.log("🔗 OAuth Redirect URL:", redirect);

  // użytkownik idzie do DISCORD
  res.redirect(redirect);
});

// ===============================================
//  /auth/callback — DISCORD ZWRACA KOD
// ===============================================
router.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Brak kodu OAuth");

  try {
    // 1. Pobranie access token
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Pobranie danych użytkownika
    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const discordUser = userRes.data;

    // 3. Sprawdzenie admin_users
    const [rows] = await pool.query(
      "SELECT * FROM admin_users WHERE discord_id = ?",
      [discordUser.id]
    );

    if (rows.length === 0) {
      return res.send("❌ Dostęp zablokowany – nie jesteś adminem.");
    }

    // 4. Tworzenie JWT
    const token = jwt.sign(
      {
        discord_id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5. Redirect do frontendu z tokenem
    const finalURL = `${process.env.FRONTEND_URL}/?token=${token}`;
    console.log("🔁 Redirect back to FE:", finalURL);

    res.redirect(finalURL);

  } catch (error) {
    console.error("OAuth ERROR:", error);
    return res.status(500).send("Błąd logowania OAuth");
  }
});

// ===============================================
//  /auth/me — SPRAWDZENIE LOGOWANIA
// ===============================================
router.get("/me", verifyJWT, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM admin_users WHERE discord_id = ? LIMIT 1",
      [req.user.discord_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Użytkownik nie istnieje" });

    res.json({
      ok: true,
      user: {
        id: rows[0].id,
        discord_id: rows[0].discord_id,
        username: rows[0].username,
        avatar: rows[0].avatar,
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
