"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
// GET /api/admin/payroll-runs
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
                where.periodStart.gte = new Date(`${from}T00:00:00.000Z`);
            if (to) {
                const d = new Date(`${to}T00:00:00.000Z`);
                d.setUTCDate(d.getUTCDate() + 1);
                where.periodStart.lt = d;
            }
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
                        paidEarly: true,
                        paidEarlyAmountCents: true,
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
// GET /api/admin/payroll-runs/:id
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
// GET /api/admin/payroll-runs/:runId/snapshots/:snapshotId
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
exports.default = router;
