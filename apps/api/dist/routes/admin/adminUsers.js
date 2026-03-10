"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../prisma");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const requireRole_1 = require("../../middleware/requireRole");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("SUPER_ADMIN"));
router.get("/users", async (_req, res) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                mustChangePassword: true,
                passwordUpdatedAt: true,
                lastLoginAt: true,
                employeeId: true,
                createdAt: true,
            },
        });
        res.json({ users });
    }
    catch (e) {
        console.error("GET /api/admin/users failed:", e);
        res.status(500).json({ error: "Failed to load users" });
    }
});
router.post("/users", async (req, res) => {
    try {
        const { name, email, role, temporaryPassword, active, mustChangePassword, employeeId, } = req.body || {};
        if (!email || !role || !temporaryPassword) {
            return res.status(400).json({ error: "email, role, temporaryPassword required" });
        }
        const passwordHash = await bcrypt_1.default.hash(String(temporaryPassword), 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: name ? String(name) : null,
                email: String(email).toLowerCase(),
                role,
                passwordHash,
                active: active !== false,
                mustChangePassword: mustChangePassword !== false,
                passwordUpdatedAt: new Date(),
                employeeId: employeeId || null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                mustChangePassword: true,
                employeeId: true,
            },
        });
        res.json({ user });
    }
    catch (e) {
        console.error("POST /api/admin/users failed:", e);
        res.status(500).json({ error: e?.message || "Failed to create user" });
    }
});
router.patch("/users/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        const { name, role, active, employeeId, mustChangePassword } = req.body || {};
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: name ? String(name) : null } : {}),
                ...(role !== undefined ? { role } : {}),
                ...(active !== undefined ? { active: !!active } : {}),
                ...(employeeId !== undefined ? { employeeId: employeeId || null } : {}),
                ...(mustChangePassword !== undefined ? { mustChangePassword: !!mustChangePassword } : {}),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                mustChangePassword: true,
                employeeId: true,
            },
        });
        res.json({ user });
    }
    catch (e) {
        console.error("PATCH /api/admin/users/:id failed:", e);
        res.status(500).json({ error: e?.message || "Failed to update user" });
    }
});
router.post("/users/:id/reset-password", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        const { temporaryPassword } = req.body || {};
        if (!temporaryPassword) {
            return res.status(400).json({ error: "temporaryPassword required" });
        }
        const passwordHash = await bcrypt_1.default.hash(String(temporaryPassword), 10);
        await prisma_1.prisma.user.update({
            where: { id },
            data: {
                passwordHash,
                mustChangePassword: true,
                passwordUpdatedAt: new Date(),
            },
        });
        res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /api/admin/users/:id/reset-password failed:", e);
        res.status(500).json({ error: e?.message || "Failed to reset password" });
    }
});
exports.default = router;
