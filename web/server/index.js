import dotenv from "dotenv";
dotenv.config();
import express from "express";
import dashboardRoutes from "./routes/dashboard.js";
import { loadGuildConfigsOnce } from "../../utils/guildRegistry.js";
import publicRoutes from "./routes/public.js";
import cors from "cors"
import eventsRoutes from "./routes/events.js";





loadGuildConfigsOnce();





const app = express();
app.use(cors({
  origin: "http://localhost:5173"
}));

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
app.use("/api/public", publicRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/public", publicRoutes);

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
