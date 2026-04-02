"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
function startOfDayUTC(iso) {
    return new Date(`${iso}T00:00:00.000Z`);
}
function startOfNextDayUTC(iso) {
    const d = startOfDayUTC(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
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
        const totalBreakMinutes = entries.reduce((sum, e) => sum + (0, _shared_1.sumBreakMinutesFromEntry)(e), 0);
        let payableMinutes = 0;
        let grossPayCents = 0;
        for (const e of entries) {
            const worked = Number(e.minutesWorked ?? 0);
            const br = (0, _shared_1.sumBreakMinutesFromEntry)(e);
            const entryPayableMinutes = Math.max(0, worked - br);
            const buckets = (0, _shared_1.splitDailyBuckets)(entryPayableMinutes);
            const holidayRule = await (0, _shared_1.getHolidayRule)(e.workDate);
            const payCalc = (0, _shared_1.calculatePayCentsWithRule)({
                regularMinutes: buckets.regularMinutes,
                overtimeMinutes: buckets.overtimeMinutes,
                doubleMinutes: buckets.doubleMinutes,
                hourlyRateCents: Number(e.employee?.hourlyRateCents || 0),
                holidayRule,
            });
            payableMinutes += entryPayableMinutes;
            grossPayCents += Number(payCalc.grossPayCents || 0);
        }
        const adjustmentWhere = {
            employeeId: String(employeeId),
            payrollRunId: null,
            paidImmediately: false,
        };
        if (from || to) {
            adjustmentWhere.workDate = {};
            if (from)
                adjustmentWhere.workDate.gte = startOfDayUTC(from);
            if (to)
                adjustmentWhere.workDate.lt = startOfNextDayUTC(to);
        }
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: adjustmentWhere,
            select: {
                id: true,
                amountCents: true,
                billAmountCents: true,
                reason: true,
                createdAt: true,
                workDate: true,
                facilityId: true,
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
