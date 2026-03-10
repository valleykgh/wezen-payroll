"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = require("./routes/authRoutes");
const meRoutes_1 = require("./routes/meRoutes");
const adminTimeRoutes_1 = require("./routes/adminTimeRoutes");
const employeeRoutes_1 = require("./routes/employeeRoutes");
const adminInviteRoutes_1 = require("./routes/adminInviteRoutes");
const admin_1 = __importDefault(require("./routes/admin"));
// import { adminRoutes } from "./routes/adminRoutes"; // uncomment if you have it
dotenv_1.default.config();
const app = (0, express_1.default)();
console.log("BUILD_ID:", process.env.BUILD_ID || "no-build-id");
/**
 * CORS
 * Avoid app.options("*", cors()) with default settings,
 * because that overrides your restricted origin list.
 */
const allowedOrigins = new Set([
    "https://payroll.wezenstaffing.com",
    "https://api.payroll.wezenstaffing.com",
    "https://dcvnabxhc4tbc.cloudfront.net",
    "http://localhost:3000",
    "http://localhost:4001",
]);
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});
app.use(express_1.default.json());
/**
 * Public routes (NO auth)
 * Keep these BEFORE mounting protected routers.
 */
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        buildId: process.env.BUILD_ID ?? "no-build-id",
    });
});
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        buildId: process.env.BUILD_ID ?? "no-build-id",
    });
});
/**
 * API routes
 * Mount under /api so /health is never protected by mistake.
 */
app.use("/api/auth", authRoutes_1.authRoutes);
app.use("/api", meRoutes_1.meRoutes);
app.use("/api", employeeRoutes_1.employeeRoutes);
app.use("/api/admin", admin_1.default);
app.use("/api/admin", adminTimeRoutes_1.adminTimeRoutes);
app.use("/api/admin", adminInviteRoutes_1.adminInviteRoutes);
// app.use("/api", adminRoutes);
/**
 * 404 fallback
 */
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});
const port = Number(process.env.PORT || 4001);
app.listen(port, "0.0.0.0", () => console.log(`API running on port ${port}`));
