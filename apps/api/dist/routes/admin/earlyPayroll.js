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
function requireAdminPin(req) {
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
router.get("/early-payroll", async (req, res) => {
    try {
        const periodStart = String(req.query.periodStart || "").trim();
        const periodEnd = String(req.query.periodEnd || "").trim();
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ error: "periodStart and periodEnd required" });
        }
        const rows = await prisma_1.prisma.earlyPayrollPayment.findMany({
            where: {
                periodStart: startOfDayUTC(periodStart),
                periodEnd: startOfDayUTC(periodEnd),
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        title: true,
                        active: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
                payrollRun: {
                    select: {
                        id: true,
                        status: true,
                        periodStart: true,
                        periodEnd: true,
                    },
                },
            },
            orderBy: [{ paidAt: "desc" }],
        });
        return res.json({ earlyPayments: rows });
    }
    catch (e) {
        console.error("GET /api/admin/early-payroll failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load early payroll payments" });
    }
});
router.post("/early-payroll", async (req, res) => {
    try {
        requireAdminPin(req);
        const employeeId = String(req.body?.employeeId || "").trim();
        const periodStart = String(req.body?.periodStart || "").trim();
        const periodEnd = String(req.body?.periodEnd || "").trim();
        const amountCents = Number(req.body?.amountCents);
        const note = req.body?.note == null ? null : String(req.body.note);
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ error: "periodStart and periodEnd required" });
        }
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
            return res.status(400).json({ error: "amountCents must be > 0" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                active: true,
            },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const createdById = req?.user?.sub
            ? String(req.user.sub)
            : (req?.user?.id ? String(req.user.id) : null);
        const normalizedPeriodStart = startOfDayUTC(periodStart);
        const normalizedPeriodEnd = startOfDayUTC(periodEnd);
        const existing = await prisma_1.prisma.earlyPayrollPayment.findFirst({
            where: {
                employeeId,
                periodStart: normalizedPeriodStart,
                periodEnd: normalizedPeriodEnd,
            },
            select: {
                id: true,
                amountCents: true,
                paidAt: true,
                payrollRunId: true,
            },
        });
        if (existing?.payrollRunId) {
            return res.status(409).json({
                error: "This early payroll payment is already attached to a payroll run and cannot be changed.",
            });
        }
        const incomingAmountCents = Math.round(amountCents);
        const previousAmountCents = Number(existing?.amountCents || 0);
        const earlyPayment = await prisma_1.prisma.$transaction(async (tx) => {
            const saved = existing
                ? await tx.earlyPayrollPayment.update({
                    where: { id: existing.id },
                    data: {
                        amountCents: previousAmountCents + incomingAmountCents,
                        note,
                        createdById,
                    },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                legalName: true,
                                preferredName: true,
                                email: true,
                                title: true,
                                active: true,
                            },
                        },
                    },
                })
                : await tx.earlyPayrollPayment.create({
                    data: {
                        employeeId,
                        periodStart: normalizedPeriodStart,
                        periodEnd: normalizedPeriodEnd,
                        amountCents: incomingAmountCents,
                        note,
                        createdById,
                    },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                legalName: true,
                                preferredName: true,
                                email: true,
                                title: true,
                                active: true,
                            },
                        },
                    },
                });
            await tx.employeePayrollLedger.create({
                data: {
                    employeeId,
                    periodStart: normalizedPeriodStart,
                    periodEnd: normalizedPeriodEnd,
                    type: "EARLY_PAY",
                    amountCents: -incomingAmountCents,
                    note: "Early payroll payment",
                    createdById,
                },
            });
            // Mark approved/locked time entries as covered by Finalize-page Pay Now
            const periodToExclusive = startOfNextDayUTC(periodEnd);
            const entries = await tx.timeEntry.findMany({
                where: {
                    employeeId,
                    workDate: {
                        gte: normalizedPeriodStart,
                        lt: periodToExclusive,
                    },
                    status: {
                        in: ["APPROVED", "LOCKED"],
                    },
                },
                include: {
                    employee: {
                        select: {
                            hourlyRateCents: true,
                        },
                    },
                    breaks: {
                        select: {
                            minutes: true,
                        },
                    },
                },
                orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
            });
            let remainingToApplyCents = previousAmountCents + incomingAmountCents;
            for (const entry of entries) {
                if (remainingToApplyCents <= 0)
                    break;
                const marker = `TIME_ENTRY_PAY_NOW:${entry.id}`;
                const existingMarker = await tx.employeePayrollLedger.findFirst({
                    where: {
                        employeeId,
                        note: { contains: marker },
                    },
                    select: { id: true },
                });
                if (existingMarker) {
                    continue;
                }
                const computedBreakMinutes = sumBreakMinutesFromEntry(entry);
                const workedMinutes = Number(entry.minutesWorked || 0);
                const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);
                const buckets = splitDailyBuckets(payableMinutes);
                const rateCents = Number(entry.employee?.hourlyRateCents || 0);
                const entryAmountCents = Math.round((buckets.regularMinutes * rateCents) / 60) +
                    Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60) +
                    Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
                if (entryAmountCents <= 0) {
                    continue;
                }
                if (remainingToApplyCents < entryAmountCents) {
                    continue;
                }
                await tx.employeePayrollLedger.create({
                    data: {
                        employeeId,
                        periodStart: normalizedPeriodStart,
                        periodEnd: normalizedPeriodEnd,
                        type: "EARNINGS_ADJUSTMENT",
                        amountCents: 0,
                        note: `Finalize pay-now marker (${marker})`,
                        createdById,
                    },
                });
                remainingToApplyCents -= entryAmountCents;
            }
            return saved;
        });
        return res.json({ ok: true, earlyPayment });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/early-payroll failed:", e);
        return res.status(status).json({
            error: e?.message || "Failed to create early payroll payment",
        });
    }
});
router.delete("/early-payroll/:id", async (req, res) => {
    try {
        requireAdminPin(req);
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const existing = await prisma_1.prisma.earlyPayrollPayment.findUnique({
            where: { id },
            select: {
                id: true,
                employeeId: true,
                periodStart: true,
                periodEnd: true,
                amountCents: true,
                payrollRunId: true,
            },
        });
        if (!existing) {
            return res.status(404).json({ error: "Early payroll record not found" });
        }
        if (existing.payrollRunId) {
            return res.status(409).json({
                error: "This early payroll payment is already attached to a payroll run and cannot be deleted.",
            });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.employeePayrollLedger.create({
                data: {
                    employeeId: existing.employeeId,
                    periodStart: existing.periodStart,
                    periodEnd: existing.periodEnd,
                    type: "EARLY_PAY",
                    amountCents: Number(existing.amountCents || 0),
                    note: "Early payroll payment reversed",
                    createdById: req.user?.id || null,
                },
            });
            await tx.earlyPayrollPayment.delete({
                where: { id },
            });
        });
        return res.json({ ok: true });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("DELETE /api/admin/early-payroll/:id failed:", e);
        return res.status(status).json({ error: e?.message || "Failed to delete early payroll payment" });
    }
});
exports.default = router;
