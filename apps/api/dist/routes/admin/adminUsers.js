"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../prisma");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
/**
 * SUPER_ADMIN only for now.
 * Later we can relax list/view to HR_ADMIN if desired.
 */
router.use(authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)("SUPER_ADMIN"));
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
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                    },
                },
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
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedRole = String(role || "").trim().toUpperCase();
        if (!normalizedEmail || !normalizedRole || !temporaryPassword) {
            return res.status(400).json({ error: "email, role, temporaryPassword required" });
        }
        if (normalizedRole !== "SUPER_ADMIN" &&
            normalizedRole !== "PAYROLL_ADMIN" &&
            normalizedRole !== "HR_ADMIN" &&
            normalizedRole !== "EMPLOYEE") {
            return res.status(400).json({ error: "Invalid role" });
        }
        const existing = await prisma_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
        });
        if (existing) {
            return res.status(409).json({ error: "Email already in use" });
        }
        const passwordHash = await bcrypt_1.default.hash(String(temporaryPassword), 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: name ? String(name).trim() : null,
                email: normalizedEmail,
                role: normalizedRole,
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
        if (!id)
            return res.status(400).json({ error: "User id required" });
        const data = {};
        if (name !== undefined) {
            data.name = name ? String(name).trim() : null;
        }
        if (role !== undefined) {
            const normalizedRole = String(role).trim().toUpperCase();
            if (normalizedRole !== "SUPER_ADMIN" &&
                normalizedRole !== "PAYROLL_ADMIN" &&
                normalizedRole !== "HR_ADMIN" &&
                normalizedRole !== "EMPLOYEE") {
                return res.status(400).json({ error: "Invalid role" });
            }
            data.role = normalizedRole;
        }
        if (active !== undefined) {
            data.active = !!active;
        }
        if (employeeId !== undefined) {
            data.employeeId = employeeId || null;
        }
        if (mustChangePassword !== undefined) {
            data.mustChangePassword = !!mustChangePassword;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data,
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
        if (!id)
            return res.status(400).json({ error: "User id required" });
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
