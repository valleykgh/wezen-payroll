"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/invite/accept", async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: "token and password required" });
        }
        const invite = await prisma_1.prisma.invite.findUnique({
            where: { token },
            include: { employee: true },
        });
        if (!invite) {
            return res.status(404).json({ error: "Invalid invite" });
        }
        if (invite.usedAt) {
            return res.status(400).json({ error: "Invite already used" });
        }
        if (invite.expiresAt < new Date()) {
            return res.status(400).json({ error: "Invite expired" });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email: invite.employee.email,
                passwordHash,
                role: "EMPLOYEE",
                employeeId: invite.employee.id,
                active: true,
                passwordUpdatedAt: new Date(),
            },
        });
        await prisma_1.prisma.invite.update({
            where: { id: invite.id },
            data: {
                usedAt: new Date(),
            },
        });
        res.json({ ok: true });
    }
    catch (e) {
        console.error("Accept invite failed:", e);
        res.status(500).json({ error: "Failed to accept invite" });
    }
});
exports.default = router;
