"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const _shared_2 = require("./_shared");
const router = express_1.default.Router();
// GET /api/admin/payroll-adjustments
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
                facility: {
                    select: {
                        id: true,
                        name: true,
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
// POST /api/admin/payroll-adjustments
router.post("/payroll-adjustments", async (req, res) => {
    try {
        const employeeId = String(req.body.employeeId || "").trim();
        const facilityId = String(req.body.facilityId || "").trim();
        const workDate = req.body.workDate ? new Date(req.body.workDate) : null;
        const shiftType = String(req.body.shiftType || "").trim() || null;
        const punchesJson = Array.isArray(req.body.punchesJson) ? req.body.punchesJson : null;
        const hasSecondShift = Array.isArray(punchesJson) &&
            punchesJson.length >= 2 &&
            String(punchesJson[1]?.clockIn || "").trim() &&
            String(punchesJson[1]?.clockOut || "").trim();
        const isCombinedShift = shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM";
        if (hasSecondShift && !isCombinedShift) {
            return res.status(400).json({
                error: "Two-shift punches were entered, but Shift Type is not combined. Please use AM+PM, PM+NOC, or NOC+AM.",
            });
        }
        if (!hasSecondShift && isCombinedShift) {
            return res.status(400).json({
                error: "Combined Shift Type selected, but second shift punches are missing.",
            });
        }
        const breaksJson = Array.isArray(req.body.breaksJson) ? req.body.breaksJson : null;
        const hours = Number(req.body.hours || 0);
        const reason = String(req.body.reason || "").trim();
        const amountCents = Number(req.body.amountCents);
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        if (!workDate || Number.isNaN(workDate.getTime())) {
            return res.status(400).json({ error: "valid workDate required" });
        }
        if (!Number.isFinite(hours) || hours <= 0) {
            return res.status(400).json({ error: "hours must be greater than 0" });
        }
        if (!reason) {
            return res.status(400).json({ error: "reason required" });
        }
        if (!Number.isFinite(amountCents) || amountCents === 0) {
            return res.status(400).json({ error: "amountCents must be a non-zero number" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, title: true, hourlyRateCents: true },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const title = String(employee.title || "").trim();
        if (!title) {
            return res.status(400).json({ error: "Employee has no title/designation" });
        }
        const facilityRates = await prisma_1.prisma.facilityRate.findMany({
            where: { facilityId },
            orderBy: [{ effectiveFrom: "desc" }],
        });
        const effectiveRate = (0, _shared_1.findEffectiveFacilityRate)(facilityRates, title, new Date(workDate));
        if (!effectiveRate) {
            return res.status(400).json({
                error: `Missing billing rate for employee title "${title}" at this facility`,
            });
        }
        const payableMinutes = Math.round(hours * 60);
        const buckets = (0, _shared_1.splitDailyBuckets)(payableMinutes);
        const holidayRule = await (0, _shared_2.getHolidayRule)(workDate);
        const payCalc = (0, _shared_2.calculatePayCentsWithRule)({
            regularMinutes: buckets.regularMinutes,
            overtimeMinutes: buckets.overtimeMinutes,
            doubleMinutes: buckets.doubleMinutes,
            hourlyRateCents: Number(employee.hourlyRateCents || 0),
            holidayRule,
        });
        const regularPayCents = payCalc.regularPayCents;
        const overtimePayCents = payCalc.overtimePayCents;
        const doublePayCents = payCalc.doublePayCents;
        const grossPayCents = payCalc.grossPayCents;
        const regRateCents = Number(effectiveRate.regRateCents || 0);
        const otRateCents = Number(effectiveRate.otRateCents || 0);
        const dtRateCents = Number(effectiveRate.dtRateCents || 0);
        const computedBillAmountCents = (0, _shared_2.calculateBillCentsWithRule)({
            regularMinutes: buckets.regularMinutes,
            overtimeMinutes: buckets.overtimeMinutes,
            doubleMinutes: buckets.doubleMinutes,
            regRateCents: Number(effectiveRate.regRateCents || 0),
            otRateCents: Number(effectiveRate.otRateCents || 0),
            dtRateCents: Number(effectiveRate.dtRateCents || 0),
            holidayRule,
        });
        const duplicate = await prisma_1.prisma.payrollAdjustment.findFirst({
            where: {
                employeeId,
                facilityId,
                workDate,
                shiftType: shiftType,
            },
            select: {
                id: true,
                createdAt: true,
                reason: true,
                payrollRunId: true,
            },
        });
        if (duplicate) {
            return res.status(409).json({
                error: `A missed-entry/supplemental card already exists for this employee, facility, work date, and shift (adjustment ${duplicate.id}). Use Create Correction instead of creating another one.`,
            });
        }
        const adjustment = await prisma_1.prisma.payrollAdjustment.create({
            data: {
                employeeId,
                facilityId: facilityId || null,
                workDate,
                shiftType: shiftType,
                punchesJson,
                breaksJson,
                reason,
                amountCents,
                payableMinutes,
                regularMinutes: buckets.regularMinutes,
                overtimeMinutes: buckets.overtimeMinutes,
                doubleMinutes: buckets.doubleMinutes,
                billAmountCents: computedBillAmountCents,
                payrollRunId: null,
                paidImmediately: false,
                paidAt: null,
                paidNote: null,
                paidAmountCents: null,
                billedAt: null,
                invoiceNumber: null,
                invoiceType: null,
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
                facility: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return res.json({ ok: true, adjustment });
    }
    catch (e) {
        console.error("POST /api/admin/payroll-adjustments failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to create payroll adjustment" });
    }
});
// POST /api/admin/payroll-adjustments/:id/pay-now
router.post("/payroll-adjustments/:id/pay-now", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        const paidNote = String(req.body?.paidNote || "").trim();
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const existing = await prisma_1.prisma.payrollAdjustment.findUnique({
            where: { id },
            select: {
                id: true,
                amountCents: true,
                payrollRunId: true,
                paidImmediately: true,
                employeeId: true,
                workDate: true,
            },
        });
        if (!existing) {
            return res.status(404).json({ error: "Payroll adjustment not found" });
        }
        if (existing.payrollRunId) {
            return res.status(409).json({ error: "This adjustment is already attached to a payroll run" });
        }
        if (existing.paidImmediately) {
            return res.status(409).json({ error: "This adjustment is already marked as paid" });
        }
        const createdById = req?.user?.sub
            ? String(req.user.sub)
            : (req?.user?.id ? String(req.user.id) : null);
        const ledgerDate = existing.workDate || new Date();
        const adjustment = await prisma_1.prisma.$transaction(async (tx) => {
            const updated = await tx.payrollAdjustment.update({
                where: { id },
                data: {
                    paidImmediately: true,
                    paidAt: new Date(),
                    paidNote: paidNote || null,
                    paidAmountCents: Number(existing.amountCents || 0),
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
                    facility: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            await tx.employeePayrollLedger.create({
                data: {
                    employeeId: existing.employeeId,
                    periodStart: ledgerDate,
                    periodEnd: ledgerDate,
                    type: "EARNINGS_ADJUSTMENT",
                    amountCents: Number(existing.amountCents || 0),
                    note: "Payroll adjustment paid immediately",
                    createdById,
                },
            });
            await tx.employeePayrollLedger.create({
                data: {
                    employeeId: existing.employeeId,
                    periodStart: ledgerDate,
                    periodEnd: ledgerDate,
                    type: "EARLY_PAY",
                    amountCents: -Number(existing.amountCents || 0),
                    note: paidNote || "Immediate payroll adjustment payment",
                    createdById,
                },
            });
            return updated;
        });
        return res.json({
            ok: true,
            adjustment,
        });
    }
    catch (e) {
        console.error("POST /api/admin/payroll-adjustments/:id/pay-now failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to mark adjustment as paid now" });
    }
});
router.post("/payroll-adjustments/:id/correction", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const existing = await prisma_1.prisma.payrollAdjustment.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        hourlyRateCents: true,
                        title: true,
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ error: "Payroll adjustment not found" });
        }
        (0, _shared_2.requireAdminPinFromBody)(req);
        const workDate = String(req.body.workDate || "").trim();
        const facilityId = String(req.body.facilityId || existing.facilityId || "").trim();
        const shiftType = String(req.body.shiftType || existing.shiftType || "AM").trim();
        const punches = Array.isArray(req.body.punches) ? req.body.punches : [];
        const breaks = Array.isArray(req.body.breaks) ? req.body.breaks : [];
        const notes = String(req.body.notes || "").trim();
        if (!workDate) {
            return res.status(400).json({ error: "workDate required" });
        }
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        await (0, _shared_2.assertFacilityRateExists)({
            employeeId: String(existing.employeeId),
            facilityId,
            workDate,
        });
        const totals = (0, _shared_2.calculateTimeEntryTotals)({
            workDate,
            shiftType,
            punches,
            breaks,
            hourlyRateCents: Number(existing.employee?.hourlyRateCents || 0),
        });
        const rate = await prisma_1.prisma.facilityRate.findFirst({
            where: {
                facilityId,
                title: String(existing.employee?.title || ""),
                effectiveFrom: {
                    lte: new Date(`${workDate}T00:00:00.000Z`),
                },
            },
            orderBy: { effectiveFrom: "desc" },
        });
        const holidayRule = await (0, _shared_2.getHolidayRule)(workDate);
        const billAmountCents = rate
            ? (0, _shared_2.calculateBillCentsWithRule)({
                regularMinutes: Number(existing.regularMinutes || 0),
                overtimeMinutes: Number(existing.overtimeMinutes || 0),
                doubleMinutes: Number(existing.doubleMinutes || 0),
                regRateCents: Number(rate.regRateCents || 0),
                otRateCents: Number(rate.otRateCents || 0),
                dtRateCents: Number(rate.dtRateCents || 0),
                holidayRule,
            })
            : null;
        const duplicateCorrection = await prisma_1.prisma.payrollAdjustment.findFirst({
            where: {
                employeeId: existing.employeeId,
                facilityId,
                workDate: new Date(`${workDate}T00:00:00.000Z`),
                shiftType: shiftType,
                id: { not: existing.id },
            },
            select: { id: true },
        });
        if (duplicateCorrection) {
            return res.status(409).json({
                error: `Another supplemental/missed-entry card already exists for this employee, facility, date, and shift (adjustment ${duplicateCorrection.id}).`,
            });
        }
        const adjustment = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.payrollAdjustment.create({
                data: {
                    employeeId: existing.employeeId,
                    facilityId,
                    workDate: new Date(`${workDate}T00:00:00.000Z`),
                    shiftType: shiftType,
                    punchesJson: punches,
                    breaksJson: breaks,
                    reason: notes || `Correction of ${existing.id}`,
                    amountCents: totals.grossPayCents,
                    payableMinutes: totals.payableMinutes,
                    regularMinutes: totals.regularMinutes,
                    overtimeMinutes: totals.overtimeMinutes,
                    doubleMinutes: totals.doubleMinutes,
                    billAmountCents,
                    payrollRunId: null,
                    paidImmediately: false,
                    paidAt: null,
                    paidNote: null,
                    paidAmountCents: null,
                    billedAt: null,
                    invoiceNumber: null,
                    invoiceType: null,
                    isCorrection: true,
                    correctionOfId: existing.id,
                },
            });
            await tx.payrollAdjustment.update({
                where: { id: existing.id },
                data: {
                    isSuperseded: true,
                    supersededById: created.id,
                },
            });
            return created;
        });
        return res.json({ ok: true, adjustment });
    }
    catch (e) {
        console.error("POST /api/admin/payroll-adjustments/:id/correction failed:", e);
        return res.status(e?.status || 500).json({
            error: e?.message || "Failed to create payroll adjustment correction",
        });
    }
});
router.get("/payroll-adjustments/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const adjustment = await prisma_1.prisma.payrollAdjustment.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        hourlyRateCents: true,
                        title: true,
                    },
                },
                facility: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        if (!adjustment) {
            return res.status(404).json({ error: "Payroll adjustment not found" });
        }
        return res.json({ adjustment });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-adjustments/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load payroll adjustment" });
    }
});
router.patch("/payroll-adjustments/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const existing = await prisma_1.prisma.payrollAdjustment.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        title: true,
                        hourlyRateCents: true,
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ error: "Payroll adjustment not found" });
        }
        if (existing.payrollRunId) {
            return res.status(409).json({ error: "This adjustment is already attached to a payroll run" });
        }
        const employeeId = String(req.body.employeeId || existing.employeeId || "").trim();
        const facilityId = String(req.body.facilityId || existing.facilityId || "").trim();
        const workDate = req.body.workDate ? new Date(req.body.workDate) : existing.workDate;
        const shiftType = String(req.body.shiftType || existing.shiftType || "").trim() || null;
        const punchesJson = Array.isArray(req.body.punchesJson) ? req.body.punchesJson : existing.punchesJson;
        const breaksJson = Array.isArray(req.body.breaksJson) ? req.body.breaksJson : existing.breaksJson;
        const reason = String(req.body.reason || existing.reason || "").trim();
        const payableMinutes = Number(req.body.payableMinutes ?? existing.payableMinutes ?? 0);
        const regularMinutes = Number(req.body.regularMinutes ?? existing.regularMinutes ?? payableMinutes);
        const overtimeMinutes = Number(req.body.overtimeMinutes ?? existing.overtimeMinutes ?? 0);
        const doubleMinutes = Number(req.body.doubleMinutes ?? existing.doubleMinutes ?? 0);
        const amountCents = Number(req.body.amountCents ?? existing.amountCents ?? 0);
        if (!employeeId)
            return res.status(400).json({ error: "employeeId required" });
        if (!facilityId)
            return res.status(400).json({ error: "facilityId required" });
        if (!workDate || Number.isNaN(new Date(workDate).getTime())) {
            return res.status(400).json({ error: "valid workDate required" });
        }
        if (!reason)
            return res.status(400).json({ error: "reason required" });
        if (!Number.isFinite(payableMinutes) || payableMinutes <= 0) {
            return res.status(400).json({ error: "payableMinutes must be greater than 0" });
        }
        if (!Number.isFinite(amountCents) || amountCents === 0) {
            return res.status(400).json({ error: "amountCents must be a non-zero number" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, title: true },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const rate = await prisma_1.prisma.facilityRate.findFirst({
            where: {
                facilityId,
                title: employee.title,
                effectiveFrom: { lte: new Date(workDate) },
            },
            orderBy: { effectiveFrom: "desc" },
        });
        let billAmountCents = existing.billAmountCents ?? null;
        if (rate) {
            billAmountCents = Math.round((Number(regularMinutes || 0) * Number(rate.regRateCents || 0) +
                Number(overtimeMinutes || 0) * Number(rate.otRateCents || 0) +
                Number(doubleMinutes || 0) * Number(rate.dtRateCents || 0)) / 60);
        }
        const adjustment = await prisma_1.prisma.payrollAdjustment.update({
            where: { id },
            data: {
                employeeId,
                facilityId,
                workDate: new Date(workDate),
                shiftType: shiftType,
                punchesJson,
                breaksJson,
                reason,
                payableMinutes,
                regularMinutes,
                overtimeMinutes,
                doubleMinutes,
                amountCents,
                billAmountCents,
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
                    },
                },
                facility: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return res.json({ ok: true, adjustment });
    }
    catch (e) {
        console.error("PATCH /api/admin/payroll-adjustments/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to update payroll adjustment" });
    }
});
exports.default = router;
