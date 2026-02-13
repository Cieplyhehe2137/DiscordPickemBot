import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import session from "express-session";
import dashboardRoutes from "./routes/dashboard.js";
import publicRoutes from "./routes/public.js";
import eventsRoutes from "./routes/events.js";
import authRoutes from "./routes/auth.js";
import { loadGuildConfigsOnce } from "../../utils/guildRegistry.js";
import { requireGuild } from "./middleware/requireGuild.js";


/* ================== FIX __dirname w ES modules ================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================== LOAD .ENV ================== */

dotenv.config({ path: path.join(__dirname, ".env") });

console.log("CLIENT_ID:", process.env.DISCORD_CLIENT_ID);

/* ================== LOAD GUILD CONFIGS ================== */

loadGuildConfigsOnce();

/* ================== APP ================== */

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

/* ================== SESSION ================== */

app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // na localhost musi być false
    httpOnly: true,
    sameSite: "lax"
  }
}));

/* ================== ROUTES ================== */

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", requireGuild, dashboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/public", publicRoutes);

/* ================== HEALTH ================== */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "pickem-web",
    time: new Date().toISOString(),
  });
});

/* ================== START ================== */

const PORT = process.env.WEB_PORT || 3301;

app.listen(PORT, () => {
  console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});
