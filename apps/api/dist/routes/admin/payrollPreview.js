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
function sumBreakMinutesFromEntry(e) {
    const breaks = Array.isArray(e.breaks) ? e.breaks : [];
    if (breaks.length > 0) {
        return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
    }
    return Number(e.breakMinutes ?? 0);
}
function splitDailyBuckets(payableMinutes) {
    const m = Math.max(0, Math.floor(payableMinutes));
    const regularCap = 8 * 60;
    const otCap = 12 * 60;
    const regularMinutes = Math.min(m, regularCap);
    const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
    const doubleMinutes = Math.max(0, m - otCap);
    return { regularMinutes, overtimeMinutes, doubleMinutes };
}
router.get("/payroll-runs/preview", async (req, res) => {
    try {
        const periodStart = String(req.query.periodStart || req.query.from || "").trim();
        const periodEnd = String(req.query.periodEnd || req.query.to || "").trim();
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ error: "periodStart and periodEnd required" });
        }
        function isMondayToSunday(periodStart, periodEnd) {
            const start = new Date(`${periodStart}T00:00:00.000Z`);
            const end = new Date(`${periodEnd}T00:00:00.000Z`);
            return start.getUTCDay() === 1 && end.getUTCDay() === 0;
        }
        if (!isMondayToSunday(periodStart, periodEnd)) {
            return res.status(400).json({
                error: "Please select exactly one Monday-to-Sunday pay period.",
            });
        }
        const fromDt = startOfDayUTC(periodStart);
        const toExclusive = startOfNextDayUTC(periodEnd);
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where: {
                workDate: {
                    gte: fromDt,
                    lt: toExclusive,
                },
                status: {
                    in: ["APPROVED", "LOCKED"],
                },
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        hourlyRateCents: true,
                        title: true,
                        active: true,
                    },
                },
                breaks: {
                    select: {
                        minutes: true,
                    },
                },
            },
            orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
        });
        const ledgerRows = await prisma_1.prisma.employeePayrollLedger.findMany({
            where: {
                periodEnd: {
                    gte: fromDt,
                },
                periodStart: {
                    lt: toExclusive,
                },
                type: "EARLY_PAY",
            },
            select: {
                employeeId: true,
                amountCents: true,
            },
        });
        const ledgerPaidByEmployee = new Map();
        for (const row of ledgerRows) {
            const key = String(row.employeeId);
            const amt = Number(row.amountCents || 0);
            const current = ledgerPaidByEmployee.get(key) || 0;
            if (amt < 0) {
                ledgerPaidByEmployee.set(key, current + Math.abs(amt));
            }
            else {
                ledgerPaidByEmployee.set(key, current - Math.abs(amt));
            }
        }
        const byEmployee = new Map();
        for (const e of entries) {
            const employeeId = String(e.employeeId);
            const workedMinutes = Number(e.minutesWorked || 0);
            const breakMinutes = sumBreakMinutesFromEntry(e);
            const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
            const buckets = splitDailyBuckets(payableMinutes);
            const rateCents = Number(e.employee?.hourlyRateCents || 0);
            const holidayRule = await (0, _shared_1.getHolidayRule)(e.workDate);
            const payCalc = (0, _shared_1.calculatePayCentsWithRule)({
                regularMinutes: buckets.regularMinutes,
                overtimeMinutes: buckets.overtimeMinutes,
                doubleMinutes: buckets.doubleMinutes,
                hourlyRateCents: rateCents,
                holidayRule,
            });
            const regularPayCents = payCalc.regularPayCents;
            const overtimePayCents = payCalc.overtimePayCents;
            const doublePayCents = payCalc.doublePayCents;
            const grossPayCents = payCalc.grossPayCents;
            const current = byEmployee.get(employeeId) || {
                employeeId,
                employee: e.employee,
                entryCount: 0,
                workedMinutes: 0,
                breakMinutes: 0,
                payableMinutes: 0,
                regularMinutes: 0,
                overtimeMinutes: 0,
                doubleMinutes: 0,
                grossPayCents: 0,
            };
            current.entryCount += 1;
            current.workedMinutes += workedMinutes;
            current.breakMinutes += breakMinutes;
            current.payableMinutes += payableMinutes;
            current.regularMinutes += buckets.regularMinutes;
            current.overtimeMinutes += buckets.overtimeMinutes;
            current.doubleMinutes += buckets.doubleMinutes;
            current.grossPayCents += grossPayCents;
            byEmployee.set(employeeId, current);
        }
        const employees = await Promise.all(Array.from(byEmployee.values()).map(async (row) => {
            const paidEarlyCents = Number(ledgerPaidByEmployee.get(String(row.employeeId)) || 0);
            const grossCents = Number(row.grossPayCents || 0);
            const remainingForThisPeriodCents = grossCents - paidEarlyCents;
            const underpaidCents = remainingForThisPeriodCents > 0 ? remainingForThisPeriodCents : 0;
            const overpaidCents = remainingForThisPeriodCents < 0 ? Math.abs(remainingForThisPeriodCents) : 0;
            const earlyPayment = paidEarlyCents > 0 ? { amountCents: paidEarlyCents } : null;
            return {
                ...row,
                earlyPayment,
                paidEarlyCents,
                remainingToPayCents: underpaidCents,
                underpaidCents,
                overpaidCents,
                remainingForThisPeriodCents,
                payStatus: overpaidCents > 0
                    ? "OVERPAID"
                    : underpaidCents > 0
                        ? "UNDERPAID"
                        : "SETTLED",
            };
        }));
        const totals = employees.reduce((acc, emp) => {
            acc.employeeCount += 1;
            acc.grossPayCents += Number(emp.grossPayCents || 0);
            acc.paidEarlyCents += Number(emp.paidEarlyCents || 0);
            acc.overpaidCents += Number(emp.overpaidCents || 0);
            acc.underpaidCents += Number(emp.underpaidCents || 0);
            if (Number(emp.paidEarlyCents || 0) > 0) {
                acc.paidEarlyCount += 1;
            }
            return acc;
        }, {
            employeeCount: 0,
            grossPayCents: 0,
            paidEarlyCount: 0,
            paidEarlyCents: 0,
            overpaidCents: 0,
            underpaidCents: 0,
        });
        return res.json({
            periodStart,
            periodEnd,
            employees,
            totals,
        });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-runs/preview failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to preview payroll run" });
    }
});
exports.default = router;
