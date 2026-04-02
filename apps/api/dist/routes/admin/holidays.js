"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
// GET /api/admin/holidays
router.get("/holidays", async (_req, res) => {
    try {
        const holidays = await prisma_1.prisma.holiday.findMany({
            orderBy: { date: "asc" },
        });
        return res.json({ holidays });
    }
    catch (e) {
        console.error("GET /api/admin/holidays failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load holidays" });
    }
});
// POST /api/admin/holidays
router.post("/holidays", async (req, res) => {
    try {
        const date = String(req.body?.date || "").trim();
        const name = String(req.body?.name || "").trim();
        const active = req.body?.active !== false;
        const payMultiplier = Number(req.body?.payMultiplier ?? 1.5);
        const billMultiplier = Number(req.body?.billMultiplier ?? 1.5);
        const appliesToRegularOnly = req.body?.appliesToRegularOnly !== false;
        if (!date)
            return res.status(400).json({ error: "date required" });
        if (!name)
            return res.status(400).json({ error: "name required" });
        const holiday = await prisma_1.prisma.holiday.create({
            data: {
                date: new Date(`${date}T00:00:00.000Z`),
                name,
                active,
                payMultiplier,
                billMultiplier,
                appliesToRegularOnly,
            },
        });
        return res.json({ holiday });
    }
    catch (e) {
        console.error("POST /api/admin/holidays failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to create holiday" });
    }
});
// PATCH /api/admin/holidays/:id
router.patch("/holidays/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const data = {};
        if (req.body?.date != null) {
            data.date = new Date(`${String(req.body.date).trim()}T00:00:00.000Z`);
        }
        if (req.body?.name != null)
            data.name = String(req.body.name || "").trim();
        if (req.body?.active != null)
            data.active = !!req.body.active;
        if (req.body?.payMultiplier != null)
            data.payMultiplier = Number(req.body.payMultiplier);
        if (req.body?.billMultiplier != null)
            data.billMultiplier = Number(req.body.billMultiplier);
        if (req.body?.appliesToRegularOnly != null) {
            data.appliesToRegularOnly = !!req.body.appliesToRegularOnly;
        }
        const holiday = await prisma_1.prisma.holiday.update({
            where: { id },
            data,
        });
        return res.json({ holiday });
    }
    catch (e) {
        console.error("PATCH /api/admin/holidays/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to update holiday" });
    }
});
// DELETE /api/admin/holidays/:id
router.delete("/holidays/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        await prisma_1.prisma.holiday.delete({
            where: { id },
        });
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /api/admin/holidays/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to delete holiday" });
    }
});
router.get("/holidays/active", async (_req, res) => {
    try {
        const holidays = await prisma_1.prisma.holiday.findMany({
            where: { active: true },
            select: {
                id: true,
                date: true,
                name: true,
                payMultiplier: true,
                billMultiplier: true,
                appliesToRegularOnly: true,
            },
            orderBy: { date: "asc" },
        });
        return res.json({
            holidays: holidays.map((h) => ({
                id: h.id,
                date: new Date(h.date).toISOString().slice(0, 10),
                name: h.name,
                payMultiplier: Number(h.payMultiplier || 1.5),
                billMultiplier: Number(h.billMultiplier || 1.5),
                appliesToRegularOnly: !!h.appliesToRegularOnly,
            })),
        });
    }
    catch (e) {
        console.error("GET /api/admin/holidays/active failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load active holidays" });
    }
});
exports.default = router;
