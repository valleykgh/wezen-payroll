"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    try {
        const auth = String(req.headers.authorization || "");
        if (!auth.toLowerCase().startsWith("bearer ")) {
            return res.status(401).json({ error: "Missing token" });
        }
        let token = auth.slice(7).trim();
        token = token.replace(/[\u0000-\u001F\u007F]/g, "");
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET not set");
            return res.status(500).json({ error: "Server auth misconfigured" });
        }
        const payload = jsonwebtoken_1.default.verify(token, secret);
        const id = String(payload.sub || payload.id || payload.userId || "").trim();
        const role = String(payload.role || "").trim().toUpperCase();
        const employeeId = payload.employeeId == null ? null : String(payload.employeeId);
        if (!id) {
            return res.status(401).json({ error: "Invalid token (no user id)" });
        }
        if (role !== "SUPER_ADMIN" &&
            role !== "PAYROLL_ADMIN" &&
            role !== "HR_ADMIN" &&
            role !== "EMPLOYEE") {
            return res.status(401).json({ error: "Invalid token (bad role)" });
        }
        req.user = {
            id,
            role,
            employeeId,
        };
        return next();
    }
    catch (err) {
        console.error("JWT verify failed:", err?.name, err?.message);
        return res.status(401).json({ error: "Invalid token" });
    }
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return next();
    };
}
function requireAdmin(req, res, next) {
    return requireRole("SUPER_ADMIN", "PAYROLL_ADMIN", "HR_ADMIN")(req, res, next);
}
