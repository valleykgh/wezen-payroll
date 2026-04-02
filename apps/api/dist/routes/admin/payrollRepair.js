"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
function requireSuperAdmin(req) {
    const role = String(req?.user?.role || "").trim();
    if (role !== "SUPER_ADMIN") {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
    }
}
function startOfDayUTC(iso) {
    return new Date(`${iso}T00:00:00.000Z`);
}
function startOfNextDayUTC(iso) {
    const d = startOfDayUTC(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}
router.post("/payroll-repair/fix-double-counted-time-entry-pay-now", async (req, res) => {
    try {
        requireSuperAdmin(req);
        const periodStart = String(req.body?.periodStart || "").trim();
        const periodEnd = String(req.body?.periodEnd || "").trim();
        const employeeEmail = String(req.body?.employeeEmail || "").trim().toLowerCase();
        if (!periodStart || !periodEnd || !employeeEmail) {
            return res.status(400).json({
                error: "periodStart, periodEnd, employeeEmail required",
            });
        }
        const run = await prisma_1.prisma.payrollRun.findFirst({
            where: {
                periodStart: startOfDayUTC(periodStart),
                periodEnd: startOfDayUTC(periodEnd),
                status: "FINALIZED",
            },
            include: {
                employees: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                email: true,
                                legalName: true,
                            },
                        },
                    },
                },
            },
        });
        if (!run) {
            return res.status(404).json({
                error: `No finalized payroll run found for ${periodStart} -> ${periodEnd}`,
            });
        }
        const runEmp = run.employees.find((r) => String(r.employee?.email || "").toLowerCase() === employeeEmail);
        if (!runEmp) {
            return res.status(404).json({
                error: `Employee ${employeeEmail} not found in finalized payroll run`,
            });
        }
        const employeeId = runEmp.employeeId;
        const attachedAdjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: {
                employeeId,
                payrollRunId: run.id,
                workDate: {
                    gte: startOfDayUTC(periodStart),
                    lt: startOfNextDayUTC(periodEnd),
                },
            },
            select: {
                id: true,
                amountCents: true,
                reason: true,
                payrollRunId: true,
                paidImmediately: true,
                paidAt: true,
                paidAmountCents: true,
                createdAt: true,
            },
            orderBy: [{ createdAt: "asc" }],
        });
        const badAdjustments = attachedAdjustments.filter((a) => {
            const reason = String(a.reason || "").toLowerCase();
            return (reason.includes("time entry") ||
                reason.includes("pay now") ||
                reason.includes("time_entry_pay_now") ||
                Boolean(a.paidImmediately) ||
                Boolean(a.paidAt) ||
                Number(a.paidAmountCents || 0) > 0);
        });
        const duplicateAdjustmentCents = badAdjustments.reduce((sum, a) => sum + Number(a.amountCents || 0), 0);
        if (duplicateAdjustmentCents <= 0) {
            return res.json({
                ok: true,
                message: "No matching bad adjustments found.",
                payrollRunId: run.id,
                employeeId,
                employeeEmail,
                before: {
                    grossPayCents: runEmp.grossPayCents,
                    adjustmentsCents: runEmp.adjustmentsCents,
                    netPayCents: runEmp.netPayCents,
                    paidEarlyAmountCents: runEmp.paidEarlyAmountCents,
                },
                attachedAdjustments,
                badAdjustments: [],
            });
        }
        const newAdjustmentsCents = Number(runEmp.adjustmentsCents || 0) - duplicateAdjustmentCents;
        const newNetPayCents = Number(runEmp.netPayCents || 0) - duplicateAdjustmentCents;
        if (newAdjustmentsCents < 0 || newNetPayCents < 0) {
            return res.status(409).json({
                error: "Repair would make frozen payroll values negative.",
                duplicateAdjustmentCents,
                current: {
                    adjustmentsCents: runEmp.adjustmentsCents,
                    netPayCents: runEmp.netPayCents,
                },
            });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.payrollRunEmployee.update({
                where: { id: runEmp.id },
                data: {
                    adjustmentsCents: newAdjustmentsCents,
                    netPayCents: newNetPayCents,
                },
            });
            await tx.payrollAdjustment.updateMany({
                where: {
                    id: { in: badAdjustments.map((a) => a.id) },
                },
                data: {
                    payrollRunId: null,
                },
            });
        });
        const repaired = await prisma_1.prisma.payrollRunEmployee.findUnique({
            where: { id: runEmp.id },
            select: {
                grossPayCents: true,
                adjustmentsCents: true,
                netPayCents: true,
                paidEarlyAmountCents: true,
            },
        });
        return res.json({
            ok: true,
            payrollRunId: run.id,
            employeeId,
            employeeEmail,
            employeeName: runEmp.employee?.legalName || null,
            detachedAdjustmentIds: badAdjustments.map((a) => a.id),
            duplicateAdjustmentCents,
            before: {
                grossPayCents: runEmp.grossPayCents,
                adjustmentsCents: runEmp.adjustmentsCents,
                netPayCents: runEmp.netPayCents,
                paidEarlyAmountCents: runEmp.paidEarlyAmountCents,
            },
            after: repaired,
        });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/payroll-repair/fix-double-counted-time-entry-pay-now failed:", e);
        return res.status(status).json({
            error: e?.message || "Failed to repair frozen payroll run",
        });
    }
});
exports.default = router;
