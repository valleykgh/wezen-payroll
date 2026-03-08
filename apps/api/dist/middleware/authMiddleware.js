"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const auth_1 = require("../auth");
function requireAuth(req, res, next) {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token)
        return res.status(401).json({ error: "Missing Bearer token" });
    try {
        const payload = (0, auth_1.verifyToken)(token);
        // IMPORTANT: our JWT uses "sub" as user id
        const userId = payload.sub;
        if (!userId)
            return res.status(401).json({ error: "Invalid token (missing sub)" });
        req.user = { ...payload, id: userId };
        console.log("AUTH payload:", req.user);
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" });
    }
    next();
}
