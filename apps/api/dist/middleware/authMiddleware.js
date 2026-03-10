"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    try {
        const auth = String(req.headers.authorization || "");
        if (!auth.toLowerCase().startsWith("bearer ")) {
            return res.status(401).json({ error: "Missing token" });
        }
        // 1) extract token
        let token = auth.slice(7).trim();
        // 2) remove hidden control characters (can appear from copy/paste or bad storage)
        token = token.replace(/[\u0000-\u001F\u007F]/g, "");
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET not set");
            return res.status(500).json({ error: "Server auth misconfigured" });
        }
        // ✅ DO NOT JSON.parse(Buffer.from(...)) etc
        const payload = jsonwebtoken_1.default.verify(token, secret);
        const id = String(payload.id || payload.userId || payload.sub || "");
        if (!id)
            return res.status(401).json({ error: "Invalid token (no user id)" });
        req.user = {
            ...payload,
            id, // ✅ normalize
        };
        return next();
        // attach to req for downstream routes
        req.user = payload;
        return next();
    }
    catch (err) {
        console.error("JWT verify failed:", err?.name, err?.message);
        return res.status(401).json({ error: "Invalid token" });
    }
}
function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Admin only" });
    }
    next();
}
