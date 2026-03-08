"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meRoutes = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.meRoutes = (0, express_1.Router)();
exports.meRoutes.get("/me", authMiddleware_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id; // requireAuth must set this
        if (!userId)
            return res.status(401).json({ error: "Invalid token (no user id)" });
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                employeeId: true,
                employee: { select: { id: true, legalName: true, preferredName: true, hourlyRateCents: true } },
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        res.json({ user });
    }
    catch (e) {
        console.error("GET /api/me failed:", e);
        res.status(500).json({ error: "Failed to load current user" });
    }
});
