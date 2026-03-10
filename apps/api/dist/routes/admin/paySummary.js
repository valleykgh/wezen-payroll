"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
function startOfDayUTC(iso) {
    return new Date(`${iso}T00:00:00.000Z`);
}
function startOfNextDayUTC(iso) {
    const d = startOfDayUTC(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}
function sumBreakMinutesFromEntry(e) {
    const breaks = Array.isArray(e.breaks) ? e.breaks : [];
    if (breaks.length > 0) {
        return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
    }
    return Number(e.breakMinutes ?? 0);
}
// GET /api/admin/pay-summary
router.get("/pay-summary", async (req, res) => {
    try {
        const { employeeId, from, to, status } = req.query;
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        const where = {};
        where.employeeId = String(employeeId);
        const statusParam = (status ? String(status) : "").trim();
        if (statusParam && statusParam !== "ALL") {
            where.status = statusParam;
        }
        else if (!statusParam) {
            where.status = { in: ["APPROVED", "LOCKED"] };
        }
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = startOfDayUTC(from);
            if (to)
                where.workDate.lt = startOfNextDayUTC(to);
        }
        const fromDate = from ? startOfDayUTC(from) : null;
        const toExclusive = to ? startOfNextDayUTC(to) : null;
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where,
            select: {
                id: true,
                workDate: true,
                minutesWorked: true,
                breakMinutes: true,
                breaks: { select: { minutes: true } },
                employee: { select: { hourlyRateCents: true } },
            },
            orderBy: { workDate: "asc" },
        });
        const rate = entries[0]?.employee?.hourlyRateCents ?? 0;
        const totalWorkedMinutes = entries.reduce((sum, e) => sum + Number(e.minutesWorked ?? 0), 0);
        const totalBreakMinutes = entries.reduce((sum, e) => sum + sumBreakMinutesFromEntry(e), 0);
        const payableMinutes = entries.reduce((sum, e) => {
            const worked = Number(e.minutesWorked ?? 0);
            const br = sumBreakMinutesFromEntry(e);
            return sum + Math.max(0, worked - br);
        }, 0);
        const grossPayCents = Math.round((payableMinutes * rate) / 60);
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: {
                employeeId: String(employeeId),
                payrollRunId: null,
            },
            select: {
                id: true,
                amountCents: true,
                reason: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
        const adjustmentsCents = adjustments.reduce((sum, a) => sum + Number(a.amountCents ?? 0), 0);
        const loanWhere = { employeeId: String(employeeId) };
        if (fromDate)
            loanWhere.periodStart = { gte: fromDate };
        if (toExclusive)
            loanWhere.periodEnd = { lt: toExclusive };
        const loanDeductions = await prisma_1.prisma.loanDeduction.findMany({
            where: loanWhere,
            select: {
                id: true,
                amountCents: true,
                periodStart: true,
                periodEnd: true,
                createdAt: true,
                note: true,
            },
            orderBy: { createdAt: "desc" },
        });
        const loanDeductionCents = loanDeductions.reduce((sum, d) => sum + Number(d.amountCents ?? 0), 0);
        const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;
        return res.json({
            employeeId: String(employeeId),
            totals: {
                totalWorkedMinutes,
                totalBreakMinutes,
                payableMinutes,
                payableHours: Math.round((payableMinutes / 60) * 100) / 100,
                hourlyRateCents: rate,
                grossPayCents,
                adjustmentsCents,
                loanDeductionCents,
                netPayCents,
            },
            adjustments,
            loanDeductions,
            debug: { entryCount: entries.length },
        });
    }
    catch (e) {
        console.error("GET /api/admin/pay-summary failed:", e);
        return res.status(500).json({ error: "Failed to compute admin pay summary" });
    }
});
exports.default = router;
