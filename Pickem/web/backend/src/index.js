// src/index.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";   // 🔥 routing OAuth
import { pool } from "./db/pool.js";

dotenv.config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Test route
app.get("/", (req, res) => {
    res.json({ message: "Backend działa!" });
});

// test połączenia z bazą
app.get("/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 + 1 AS result");
        res.json({ ok: true, result: rows[0].result });
    } catch (err) {
        console.error("DB error:", err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// 🔥 tutaj rejestrujesz /auth/discord i /auth/callback
app.use("/auth", authRoutes);

// Start serwera
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Backend listening on port ${PORT}`);
});
