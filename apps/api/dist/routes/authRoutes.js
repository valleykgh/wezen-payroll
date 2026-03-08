"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../prisma");
const auth_1 = require("../auth");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.authRoutes = (0, express_1.Router)();
/**
 * Employee self-signup:
 * - creates Employee
 * - creates User linked to Employee
 */
exports.authRoutes.post("/register", async (req, res) => {
    const { email, password, legalName, preferredName } = req.body || {};
    if (!email || !password || !legalName) {
        return res.status(400).json({ error: "email, password, legalName are required" });
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing)
        return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const employee = await prisma_1.prisma.employee.create({
        data: { email, legalName, preferredName: preferredName ?? null, hourlyRateCents: 0, active: true },
    });
    const user = await prisma_1.prisma.user.create({
        data: {
            email,
            passwordHash,
            role: "EMPLOYEE",
            employeeId: employee.id,
        },
    });
    const token = (0, auth_1.signToken)({ sub: user.id, role: user.role, employeeId: user.employeeId });
    res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
        mustChangePassword: user.mustChangePassword,
    });
});
exports.authRoutes.post("/change-password", authMiddleware_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body || {};
        if (!newPassword)
            return res.status(400).json({ error: "newPassword required" });
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // If mustChangePassword is true, allow change without currentPassword
        if (!user.mustChangePassword) {
            if (!currentPassword)
                return res.status(400).json({ error: "currentPassword required" });
            const ok = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
            if (!ok)
                return res.status(401).json({ error: "Invalid current password" });
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { passwordHash, mustChangePassword: false },
        });
        res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /api/auth/change-password failed:", e);
        res.status(500).json({ error: "Failed to change password" });
    }
});
exports.authRoutes.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return res.status(400).json({ error: "email and password required" });
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ error: "Invalid credentials" });
    const token = (0, auth_1.signToken)({ sub: user.id, role: user.role, employeeId: user.employeeId });
    res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
        mustChangePassword: user.mustChangePassword,
    });
});
exports.authRoutes.post("/accept-invite", async (req, res) => {
    try {
        const { token, password } = req.body || {};
        if (!token || !password)
            return res.status(400).json({ error: "token and password required" });
        const invite = await prisma_1.prisma.invite.findUnique({
            where: { token: String(token) },
            select: {
                id: true,
                employeeId: true,
                email: true,
                expiresAt: true,
                usedAt: true,
                employee: { select: { id: true, email: true } },
            },
        });
        if (!invite)
            return res.status(400).json({ error: "Invalid invite token" });
        if (invite.usedAt)
            return res.status(400).json({ error: "Invite already used" });
        if (new Date(invite.expiresAt).getTime() < Date.now())
            return res.status(400).json({ error: "Invite expired" });
        // Prefer invite.email if present, else employee.email
        const email = invite.email ?? invite.employee?.email;
        if (!email)
            return res.status(400).json({ error: "Invite missing employee email" });
        const employeeId = invite.employee?.id ?? invite.employeeId;
        if (!employeeId)
            return res.status(404).json({ error: "Employee not found" });
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        // Create user if missing; otherwise set password
        const user = await prisma_1.prisma.user.upsert({
            where: { email },
            update: {
                passwordHash,
                employeeId,
                role: "EMPLOYEE",
                mustChangePassword: false,
            },
            create: {
                email,
                passwordHash,
                role: "EMPLOYEE",
                employeeId,
                mustChangePassword: false,
            },
            select: { id: true, email: true, role: true, employeeId: true, mustChangePassword: true },
        });
        await prisma_1.prisma.invite.update({
            where: { id: invite.id },
            data: { usedAt: new Date() },
        });
        const jwt = (0, auth_1.signToken)({ sub: user.id, role: user.role, employeeId: user.employeeId });
        res.json({ token: jwt, user });
    }
    catch (e) {
        console.error("POST /api/auth/accept-invite failed:", e);
        res.status(500).json({ error: "Failed to accept invite" });
    }
});
