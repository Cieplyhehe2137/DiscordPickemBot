import express from "express";
import dashboardRoutes from "./routes/dashboard.js";
import path from "path";
import { fileURLToPath } from "url";
import { loadGuildConfigsOnce } from "../../utils/guildRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.GUILD_CONFIG_DIR = path.resolve(__dirname, "../../config");

loadGuildConfigsOnce();





const app = express();
const PORT = process.env.WEB_PORT || 3301;

app.use(express.json());

// ✅ ROUTES
app.use((req, _res, next) => {
    req.user = {
        discordId: "123",
        guildId: "1161660208951607397",
        isAdmin: true
    };
    next();
});

app.use("/api/dashboard", dashboardRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "pickem-web",
        time: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});
