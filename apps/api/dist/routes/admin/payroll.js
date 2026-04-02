"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.get("/pay-summary", async (req, res) => {
    try {
        const { employeeId, from, to, status } = req.query;
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        const where = {};
        if (employeeId)
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
                where.workDate.gte = (0, _shared_1.startOfDayUTC)(from);
            if (to)
                where.workDate.lt = (0, _shared_1.startOfNextDayUTC)(to);
        }
        const fromDate = from ? (0, _shared_1.startOfDayUTC)(from) : null;
        const toExclusive = to ? (0, _shared_1.startOfNextDayUTC)(to) : null;
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
        const payableMinutes = entries.reduce((sum, e) => {
            const worked = Number(e.minutesWorked ?? 0);
            const br = (0, _shared_1.sumBreakMinutesFromEntry)(e);
            return sum + Math.max(0, worked - br);
        }, 0);
        const grossPayCents = Math.round((payableMinutes * rate) / 60);
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: {
                employeeId: String(employeeId),
                payrollRunId: null,
            },
            select: { amountCents: true },
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
                amountCents: true,
            },
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
                netPayCents,
                loanDeductionCents,
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
router.get("/payroll-adjustments", async (req, res) => {
    try {
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                    },
                },
                payrollRun: {
                    select: {
                        id: true,
                        periodStart: true,
                        periodEnd: true,
                        status: true,
                    },
                },
            },
            orderBy: [{ createdAt: "desc" }],
        });
        return res.json({ adjustments });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-adjustments failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load payroll adjustments" });
    }
});
router.get("/payroll-runs", async (req, res) => {
    try {
        const status = String(req.query.status || "").trim();
        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();
        const where = {};
        if (status) {
            where.status = status;
        }
        if (from || to) {
            where.periodStart = {};
            if (from)
                where.periodStart.gte = (0, _shared_1.startOfDayUTC)(from);
            if (to)
                where.periodStart.lt = (0, _shared_1.startOfNextDayUTC)(to);
        }
        const runs = await prisma_1.prisma.payrollRun.findMany({
            where,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
                employees: {
                    select: {
                        id: true,
                        employeeId: true,
                        grossPayCents: true,
                        adjustmentsCents: true,
                        loanDeductionCents: true,
                        netPayCents: true,
                    },
                },
            },
            orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
        });
        const items = runs.map((run) => {
            const employeeCount = run.employees.length;
            const grossPayCents = run.employees.reduce((sum, e) => sum + Number(e.grossPayCents || 0), 0);
            const adjustmentsCents = run.employees.reduce((sum, e) => sum + Number(e.adjustmentsCents || 0), 0);
            const loanDeductionCents = run.employees.reduce((sum, e) => sum + Number(e.loanDeductionCents || 0), 0);
            const netPayCents = run.employees.reduce((sum, e) => sum + Number(e.netPayCents || 0), 0);
            return {
                id: run.id,
                periodStart: run.periodStart,
                periodEnd: run.periodEnd,
                status: run.status,
                notes: run.notes,
                finalizedAt: run.finalizedAt,
                createdAt: run.createdAt,
                createdBy: run.createdBy,
                employeeCount,
                grossPayCents,
                adjustmentsCents,
                loanDeductionCents,
                netPayCents,
            };
        });
        return res.json({ payrollRuns: items });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-runs failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to list payroll runs" });
    }
});
router.get("/payroll-runs/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const payrollRun = await prisma_1.prisma.payrollRun.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
                employees: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                legalName: true,
                                preferredName: true,
                                email: true,
                                hourlyRateCents: true,
                                payrollAdjustments: {
                                    orderBy: { createdAt: "desc" },
                                    select: {
                                        id: true,
                                        amountCents: true,
                                        reason: true,
                                        createdAt: true,
                                        payrollRunId: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        employeeId: "asc",
                    },
                },
                entrySnapshots: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                legalName: true,
                                preferredName: true,
                                email: true,
                            },
                        },
                        corrections: {
                            select: {
                                id: true,
                                reason: true,
                                adjustmentAmountCents: true,
                                createdAt: true,
                                createdById: true,
                                payrollAdjustmentId: true,
                            },
                            orderBy: {
                                createdAt: "desc",
                            },
                        },
                    },
                    orderBy: {
                        workDate: "asc",
                    },
                },
            },
        });
        if (!payrollRun) {
            return res.status(404).json({ error: "Payroll run not found" });
        }
        return res.json({ payrollRun });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-runs/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load payroll run" });
    }
});
router.get("/payroll-runs/:runId/snapshots/:snapshotId", async (req, res) => {
    try {
        const runId = String(req.params.runId || "");
        const snapshotId = String(req.params.snapshotId || "");
        const snapshot = await prisma_1.prisma.payrollRunEntrySnapshot.findFirst({
            where: {
                id: snapshotId,
                payrollRunId: runId,
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                    },
                },
                payrollRun: {
                    select: {
                        id: true,
                        periodStart: true,
                        periodEnd: true,
                        status: true,
                    },
                },
            },
        });
        if (!snapshot) {
            return res.status(404).json({ error: "Snapshot not found" });
        }
        return res.json({ snapshot });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-runs/:runId/snapshots/:snapshotId failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load payroll snapshot" });
    }
});
router.get("/payroll-correction/calc", async (req, res) => {
    try {
        const employeeId = String(req.query.employeeId || "").trim();
        const workDate = String(req.query.workDate || "").trim();
        const shiftType = String(req.query.shiftType || "AM").trim();
        const punchesRaw = String(req.query.punches || "[]");
        const breaksRaw = String(req.query.breaks || "[]");
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!workDate) {
            return res.status(400).json({ error: "workDate required" });
        }
        const punches = JSON.parse(punchesRaw);
        const breaks = JSON.parse(breaksRaw);
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                hourlyRateCents: true,
            },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const calc = (0, _shared_1.calculateTimeEntryTotals)({
            workDate,
            shiftType,
            punches,
            breaks,
            hourlyRateCents: employee.hourlyRateCents,
        });
        return res.json({
            input: {
                workDate,
                shiftType,
                workedMinutes: calc.workedMinutes,
                breakMinutes: calc.breakMinutes,
                payableMinutes: calc.payableMinutes,
            },
            buckets: {
                regularMinutes: calc.regularMinutes,
                overtimeMinutes: calc.overtimeMinutes,
                doubleMinutes: calc.doubleMinutes,
                regular_decimal: (0, _shared_1.minutesToDecimalHours)(calc.regularMinutes),
                overtime_decimal: (0, _shared_1.minutesToDecimalHours)(calc.overtimeMinutes),
                double_decimal: (0, _shared_1.minutesToDecimalHours)(calc.doubleMinutes),
                calculatedHours_decimal: (0, _shared_1.minutesToDecimalHours)(calc.payableMinutes),
            },
            pay: {
                hourlyRateCents: employee.hourlyRateCents,
                regularPayCents: calc.regularPayCents,
                overtimePayCents: calc.overtimePayCents,
                doublePayCents: calc.doublePayCents,
                grossPayCents: calc.grossPayCents,
            },
            display: {
                calculatedHours_decimal: (0, _shared_1.minutesToDecimalHours)(calc.payableMinutes),
            },
        });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-correction/calc failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to calculate payroll correction" });
    }
});
router.post("/payroll-corrections", async (req, res) => {
    try {
        const { payrollRunId, payrollRunSnapshotId, employeeId, workDate, reason, originalSnapshotJson, correctedInputJson, correctedResultJson, adjustmentAmountCents, } = req.body || {};
        const runId = String(payrollRunId || "").trim();
        const snapshotId = String(payrollRunSnapshotId || "").trim();
        const empId = String(employeeId || "").trim();
        const workDateStr = String(workDate || "").trim();
        const reasonStr = String(reason || "").trim();
        const deltaCents = Number(adjustmentAmountCents);
        if (!runId)
            return res.status(400).json({ error: "payrollRunId required" });
        if (!snapshotId)
            return res.status(400).json({ error: "payrollRunSnapshotId required" });
        if (!empId)
            return res.status(400).json({ error: "employeeId required" });
        if (!workDateStr)
            return res.status(400).json({ error: "workDate required" });
        if (!reasonStr)
            return res.status(400).json({ error: "reason required" });
        if (!Number.isFinite(deltaCents) || deltaCents === 0) {
            return res.status(400).json({ error: "adjustmentAmountCents must be a non-zero number" });
        }
        const snapshot = await prisma_1.prisma.payrollRunEntrySnapshot.findFirst({
            where: {
                id: snapshotId,
                payrollRunId: runId,
                employeeId: empId,
            },
            select: {
                id: true,
                payrollRunId: true,
                employeeId: true,
            },
        });
        if (!snapshot) {
            return res.status(404).json({ error: "Payroll snapshot not found" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: empId },
            select: { id: true },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const createdById = req?.user?.sub ? String(req.user.sub) : null;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const adjustment = await tx.payrollAdjustment.create({
                data: {
                    employeeId: empId,
                    amountCents: Math.round(deltaCents),
                    reason: reasonStr,
                    payrollRunId: null,
                },
            });
            const correction = await tx.payrollCorrection.create({
                data: {
                    payrollRunId: runId,
                    payrollRunSnapshotId: snapshotId,
                    employeeId: empId,
                    workDate: new Date(`${workDateStr}T00:00:00.000Z`),
                    reason: reasonStr,
                    originalSnapshotJson,
                    correctedInputJson,
                    correctedResultJson,
                    adjustmentAmountCents: Math.round(deltaCents),
                    payrollAdjustmentId: adjustment.id,
                    createdById,
                },
            });
            return { adjustment, correction };
        });
        return res.json({
            ok: true,
            adjustment: result.adjustment,
            correction: result.correction,
        });
    }
    catch (e) {
        console.error("POST /api/admin/payroll-corrections failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to create payroll correction" });
    }
});
exports.default = router;
