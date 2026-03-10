"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
function requireFacilityPin(req) {
    const pin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
    const expected = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();
    if (!expected) {
        const err = new Error("Admin PIN is not configured");
        err.status = 500;
        throw err;
    }
    if (!pin || pin !== expected) {
        const err = new Error("Invalid PIN");
        err.status = 403;
        throw err;
    }
}
router.get("/facilities/:facilityId/rates", async (req, res) => {
    try {
        const { facilityId } = req.params;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        const rates = await prisma_1.prisma.facilityRate.findMany({
            where: { facilityId: String(facilityId) },
            orderBy: [{ title: "asc" }, { effectiveFrom: "desc" }],
        });
        return res.json({ facilityId, rates });
    }
    catch (e) {
        console.error("GET /api/admin/facilities/:facilityId/rates failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load facility rates" });
    }
});
router.post("/facilities/:facilityId/rates", async (req, res) => {
    try {
        requireFacilityPin(req);
        const { facilityId } = req.params;
        const { title, effectiveFrom, regRateCents, otRateCents, dtRateCents } = req.body || {};
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        if (!["CNA", "LVN", "RN"].includes(String(title))) {
            return res.status(400).json({ error: "title must be CNA|LVN|RN" });
        }
        if (!effectiveFrom) {
            return res.status(400).json({ error: "effectiveFrom required (YYYY-MM-DD)" });
        }
        const reg = Number(regRateCents);
        const ot = Number(otRateCents);
        const dt = Number(dtRateCents);
        if (![reg, ot, dt].every((n) => Number.isFinite(n) && n >= 0)) {
            return res.status(400).json({ error: "rates must be cents numbers >= 0" });
        }
        const effectiveFromDate = new Date(`${String(effectiveFrom)}T00:00:00.000Z`);
        if (Number.isNaN(effectiveFromDate.getTime())) {
            return res.status(400).json({ error: "effectiveFrom must be a valid YYYY-MM-DD date" });
        }
        const existing = await prisma_1.prisma.facilityRate.findFirst({
            where: {
                facilityId: String(facilityId),
                title: String(title),
                effectiveFrom: effectiveFromDate,
            },
            select: { id: true },
        });
        let rate;
        if (existing) {
            rate = await prisma_1.prisma.facilityRate.update({
                where: { id: existing.id },
                data: {
                    regRateCents: Math.round(reg),
                    otRateCents: Math.round(ot),
                    dtRateCents: Math.round(dt),
                },
            });
        }
        else {
            rate = await prisma_1.prisma.facilityRate.create({
                data: {
                    facilityId: String(facilityId),
                    title: String(title),
                    effectiveFrom: effectiveFromDate,
                    regRateCents: Math.round(reg),
                    otRateCents: Math.round(ot),
                    dtRateCents: Math.round(dt),
                },
            });
        }
        return res.json({ ok: true, rate });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/facilities/:facilityId/rates failed:", e);
        return res.status(status).json({ error: e?.message || "Failed to save facility rate" });
    }
});
exports.default = router;
