"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeRoutes = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const paystubPdf_1 = require("../services/paystubPdf");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.employeeRoutes = (0, express_1.Router)();
exports.employeeRoutes.use(authMiddleware_1.requireAuth);
function startOfDay(dateISO) {
    // dateISO: "YYYY-MM-DD"
    return new Date(`${dateISO}T00:00:00`);
}
function startOfNextDay(dateISO) {
    const d = startOfDay(dateISO);
    d.setDate(d.getDate() + 1);
    return d;
}
function sumBreakMinutesFromEntry(e) {
    const breaks = Array.isArray(e.breaks) ? e.breaks : [];
    if (breaks.length > 0) {
        return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
    }
    return Number(e.breakMinutes ?? 0);
}
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
function formatDateISO(d) {
    return d.toISOString().slice(0, 10);
}
// TODO: replace with Admin/Company settings later
const COMPANY_INFO = {
    legalName: "Wezen Staffing",
    addressLine1: "2498 Livorno Ct",
    city: "Livermore",
    state: "CA",
    zip: "94550",
};
async function computeLoanDeductionCentsForPeriod(employeeId, from, to) {
    // only count loans that still have outstanding > 0
    const loans = await prisma_1.prisma.employeeLoan.findMany({
        where: { employeeId },
        include: { deductions: true },
        orderBy: { createdAt: "asc" },
    });
    // compute how many payroll weeks are in range
    // simplest: 1 deduction per pay-summary request (weekly payroll)
    // If your pay-summary is ALWAYS weekly, we just deduct once.
    // If your pay-summary can be 2 weeks, we deduct per week boundaries (Step 5C).
    const isRange = Boolean(from || to);
    // ✅ if your payroll is always weekly, do ONE deduction per loan per period query:
    const deductOnce = true;
    let total = 0;
    for (const l of loans) {
        const deductedCents = (l.deductions || []).reduce((s, d) => s + Number(d.amountCents ?? 0), 0);
        const outstanding = Math.max(0, Number(l.principalCents ?? 0) - deductedCents);
        if (outstanding <= 0)
            continue;
        const weekly = Number(l.weeklyDeductionCents ?? 0);
        if (weekly <= 0)
            continue;
        const raw = deductOnce ? weekly : weekly; // we'll expand this in Step 5C
        const applied = Math.min(outstanding, raw);
        total += applied;
    }
    return total;
}
exports.employeeRoutes.get("/employee/time-entries", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const { from, to } = req.query;
        const where = {
            employeeId,
            status: { in: ["APPROVED", "LOCKED"] },
        };
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = startOfDay(from);
            if (to)
                where.workDate.lt = startOfNextDay(to); // IMPORTANT: exclusive end
        }
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where,
            orderBy: { workDate: "desc" },
            include: {
                breaks: { select: { startTime: true, endTime: true, minutes: true } },
            },
        });
        const entriesWithComputed = entries.map((e) => {
            const breaks = Array.isArray(e.breaks) ? e.breaks : [];
            const computedBreakMinutes = breaks.length > 0
                ? breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0)
                : Number(e.breakMinutes ?? 0);
            return { ...e, computedBreakMinutes };
        });
        res.json({ entries: entriesWithComputed });
    }
    catch (e) {
        console.error("GET /api/employee/time-entries failed:", e);
        res.status(500).json({ error: "Failed to load time entries" });
    }
});
exports.employeeRoutes.get("/employee/pay-summary", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const { from, to } = req.query;
        const employee = await prisma_1.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee)
            return res.status(404).json({ error: "Employee not found" });
        const where = {
            employeeId,
            status: { in: ["APPROVED", "LOCKED"] },
        };
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = startOfDay(from);
            if (to)
                where.workDate.lt = startOfNextDay(to); // IMPORTANT: exclusive end
        }
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where,
            select: {
                id: true,
                workDate: true,
                minutesWorked: true, // WORKED minutes
                breakMinutes: true, // fallback only
                breaks: { select: { minutes: true } },
            },
            orderBy: { workDate: "asc" },
        });
        let totalWorkedMinutes = 0;
        let totalBreakMinutes = 0;
        let totalPayableMinutes = 0;
        let regularMinutes = 0;
        let overtimeMinutes = 0;
        let doubleMinutes = 0;
        for (const e of entries) {
            const worked = Number(e.minutesWorked ?? 0);
            const breaks = sumBreakMinutesFromEntry(e);
            const payable = Math.max(0, worked - breaks);
            totalWorkedMinutes += worked;
            totalBreakMinutes += breaks;
            totalPayableMinutes += payable;
            const regularCap = 8 * 60;
            const otCap = 12 * 60;
            const reg = Math.min(payable, regularCap);
            const ot = Math.max(0, Math.min(payable, otCap) - regularCap);
            const dt = Math.max(0, payable - otCap);
            regularMinutes += reg;
            overtimeMinutes += ot;
            doubleMinutes += dt;
        }
        const rateCents = Number(employee.hourlyRateCents || 0);
        const regularPayCents = Math.round((regularMinutes * rateCents) / 60);
        const overtimePayCents = Math.round((overtimeMinutes * rateCents * 1.5) / 60);
        const doublePayCents = Math.round((doubleMinutes * rateCents * 2) / 60);
        const grossPayCents = regularPayCents +
            overtimePayCents +
            doublePayCents;
        const payableHours = Math.round((totalPayableMinutes / 60) * 100) / 100;
        // ---- Payroll adjustments (same date window as entries) ----
        const adjWhere = { employeeId };
        if (from || to) {
            adjWhere.createdAt = {};
            if (from)
                adjWhere.createdAt.gte = startOfDay(from);
            if (to)
                adjWhere.createdAt.lt = startOfNextDay(to);
        }
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: adjWhere,
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                createdAt: true,
                amountCents: true,
                reason: true,
            },
        });
        const adjustmentsCents = adjustments.reduce((sum, a) => sum + Number(a.amountCents ?? 0), 0);
        // ---- Loan deductions (same date window as entries) ----
        const loanWhere = { employeeId };
        if (from || to) {
            if (from) {
                loanWhere.periodStart = { gte: startOfDay(from) };
            }
            if (to) {
                loanWhere.periodEnd = { lt: startOfNextDay(to) };
            }
        }
        const loanDeductions = await prisma_1.prisma.loanDeduction.findMany({
            where: loanWhere,
            select: { amountCents: true },
        });
        const loanDeductionCents = loanDeductions.reduce((sum, d) => sum + Number(d.amountCents ?? 0), 0);
        const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;
        // net = gross + payroll adjustments - loan deductions
        return res.json({
            employee: {
                id: employee.id,
                legalName: employee.legalName,
                preferredName: employee.preferredName,
                email: employee.email,
                hourlyRateCents: employee.hourlyRateCents,
            },
            totals: {
                totalMinutes: totalWorkedMinutes,
                totalBreakMinutes,
                payableMinutes: totalPayableMinutes,
                totalHours: payableHours,
                regularMinutes,
                overtimeMinutes,
                doubleMinutes,
                regularPayCents,
                overtimePayCents,
                doublePayCents,
                grossPayCents,
                adjustmentsCents,
                loanDeductionCents,
                netPayCents,
            },
            adjustments,
            // ✅ optional debug goes INSIDE the same JSON response
            debug: {
                entryCount: entries.length,
            },
        });
    }
    catch (e) {
        console.error("GET /api/employee/pay-summary failed:", e);
        return res.status(500).json({ error: "Failed to load pay summary" });
    }
});
exports.employeeRoutes.get("/employee/profile", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
            },
        });
        if (!employee)
            return res.status(404).json({ error: "Employee not found" });
        return res.json({ employee });
    }
    catch (e) {
        console.error("GET /api/employee/profile failed:", e);
        return res.status(500).json({ error: "Failed to load employee profile" });
    }
});
exports.employeeRoutes.get("/employee/paystub", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: "from and to are required" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
            },
        });
        if (!employee)
            return res.status(404).json({ error: "Employee not found" });
        const entryWhere = {
            employeeId,
            status: { in: ["APPROVED", "LOCKED"] },
            workDate: {
                gte: startOfDay(from),
                lt: startOfNextDay(to),
            },
        };
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where: entryWhere,
            select: {
                id: true,
                workDate: true,
                minutesWorked: true,
                breakMinutes: true,
                breaks: { select: { minutes: true } },
            },
            orderBy: { workDate: "asc" },
        });
        let totalWorkedMinutes = 0;
        let totalBreakMinutes = 0;
        let totalPayableMinutes = 0;
        let regularMinutes = 0;
        let overtimeMinutes = 0;
        let doubleMinutes = 0;
        for (const e of entries) {
            const worked = Number(e.minutesWorked ?? 0);
            const breaks = sumBreakMinutesFromEntry(e);
            const payable = Math.max(0, worked - breaks);
            totalWorkedMinutes += worked;
            totalBreakMinutes += breaks;
            totalPayableMinutes += payable;
            const regularCap = 8 * 60;
            const otCap = 12 * 60;
            const reg = Math.min(payable, regularCap);
            const ot = Math.max(0, Math.min(payable, otCap) - regularCap);
            const dt = Math.max(0, payable - otCap);
            regularMinutes += reg;
            overtimeMinutes += ot;
            doubleMinutes += dt;
        }
        const rateCents = Number(employee.hourlyRateCents || 0);
        const regularPayCents = Math.round((regularMinutes * rateCents) / 60);
        const overtimePayCents = Math.round((overtimeMinutes * rateCents * 1.5) / 60);
        const doublePayCents = Math.round((doubleMinutes * rateCents * 2) / 60);
        const grossPayCents = regularPayCents +
            overtimePayCents +
            doublePayCents;
        const payableHours = Math.round((totalPayableMinutes / 60) * 100) / 100;
        const adjWhere = {
            employeeId,
            createdAt: {
                gte: startOfDay(from),
                lt: startOfNextDay(to),
            },
        };
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: adjWhere,
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                createdAt: true,
                amountCents: true,
                reason: true,
            },
        });
        const adjustmentsCents = adjustments.reduce((sum, a) => sum + Number(a.amountCents ?? 0), 0);
        const loanWhere = {
            employeeId,
            periodStart: { gte: startOfDay(from) },
            periodEnd: { lt: startOfNextDay(to) },
        };
        const loanDeductions = await prisma_1.prisma.loanDeduction.findMany({
            where: loanWhere,
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                amountCents: true,
                note: true,
                periodStart: true,
                periodEnd: true,
            },
        });
        const loanDeductionCents = loanDeductions.reduce((sum, d) => sum + Number(d.amountCents ?? 0), 0);
        const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;
        // Assumption: pay date is Friday after payroll week end (Sunday)
        const payDate = formatDateISO(addDays(startOfDay(to), 5));
        return res.json({
            company: COMPANY_INFO,
            employee: {
                ...employee,
            },
            payPeriod: {
                from,
                to,
                payDate,
            },
            totals: {
                totalWorkedMinutes,
                totalBreakMinutes,
                totalPayableMinutes,
                payableHours,
                regularMinutes,
                overtimeMinutes,
                doubleMinutes,
                regularPayCents,
                overtimePayCents,
                doublePayCents,
                grossPayCents,
                adjustmentsCents,
                loanDeductionCents,
                netPayCents,
            },
            adjustments,
            loanDeductions,
            entries,
        });
    }
    catch (e) {
        console.error("GET /api/employee/paystub failed:", e);
        return res.status(500).json({ error: "Failed to load paystub" });
    }
});
exports.employeeRoutes.get("/employee/paystub/pdf", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: "from and to required" });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
            },
        });
        if (!employee)
            return res.status(404).json({ error: "Employee not found" });
        const entryWhere = {
            employeeId,
            status: { in: ["APPROVED", "LOCKED"] },
            workDate: {
                gte: startOfDay(from),
                lt: startOfNextDay(to),
            },
        };
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where: entryWhere,
            select: {
                id: true,
                workDate: true,
                minutesWorked: true,
                breakMinutes: true,
                breaks: { select: { minutes: true } },
            },
            orderBy: { workDate: "asc" },
        });
        let totalWorkedMinutes = 0;
        let totalBreakMinutes = 0;
        let totalPayableMinutes = 0;
        let regularMinutes = 0;
        let overtimeMinutes = 0;
        let doubleMinutes = 0;
        for (const e of entries) {
            const worked = Number(e.minutesWorked ?? 0);
            const breaks = sumBreakMinutesFromEntry(e);
            const payable = Math.max(0, worked - breaks);
            totalWorkedMinutes += worked;
            totalBreakMinutes += breaks;
            totalPayableMinutes += payable;
            const regularCap = 8 * 60;
            const otCap = 12 * 60;
            const reg = Math.min(payable, regularCap);
            const ot = Math.max(0, Math.min(payable, otCap) - regularCap);
            const dt = Math.max(0, payable - otCap);
            regularMinutes += reg;
            overtimeMinutes += ot;
            doubleMinutes += dt;
        }
        const rateCents = Number(employee.hourlyRateCents || 0);
        const regularPayCents = Math.round((regularMinutes * rateCents) / 60);
        const overtimePayCents = Math.round((overtimeMinutes * rateCents * 1.5) / 60);
        const doublePayCents = Math.round((doubleMinutes * rateCents * 2) / 60);
        const grossPayCents = regularPayCents +
            overtimePayCents +
            doublePayCents;
        const payableHours = Math.round((totalPayableMinutes / 60) * 100) / 100;
        const adjustments = await prisma_1.prisma.payrollAdjustment.findMany({
            where: {
                employeeId,
                createdAt: {
                    gte: startOfDay(from),
                    lt: startOfNextDay(to),
                },
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                createdAt: true,
                amountCents: true,
                reason: true,
            },
        });
        const adjustmentsCents = adjustments.reduce((sum, a) => sum + Number(a.amountCents ?? 0), 0);
        const loanDeductions = await prisma_1.prisma.loanDeduction.findMany({
            where: {
                employeeId,
                periodStart: { gte: startOfDay(from) },
                periodEnd: { lt: startOfNextDay(to) },
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                amountCents: true,
                note: true,
                periodStart: true,
                periodEnd: true,
            },
        });
        const loanDeductionCents = loanDeductions.reduce((sum, d) => sum + Number(d.amountCents ?? 0), 0);
        const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;
        const payDate = formatDateISO(addDays(startOfDay(to), 5));
        const pdf = await (0, paystubPdf_1.generatePaystubPdf)({
            company: COMPANY_INFO,
            employee,
            payPeriod: {
                from,
                to,
                payDate,
            },
            totals: {
                totalWorkedMinutes,
                totalBreakMinutes,
                totalPayableMinutes,
                payableHours,
                regularMinutes,
                overtimeMinutes,
                doubleMinutes,
                regularPayCents,
                overtimePayCents,
                doublePayCents,
                grossPayCents,
                adjustmentsCents,
                loanDeductionCents,
                netPayCents,
            },
            adjustments,
            loanDeductions,
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="paystub-${from}-${to}.pdf"`);
        return res.send(pdf);
    }
    catch (e) {
        console.error("GET /api/employee/paystub/pdf failed:", e);
        return res.status(500).json({ error: "Failed to generate paystub pdf" });
    }
});
exports.employeeRoutes.patch("/employee/profile", async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId)
            return res.status(400).json({ error: "No employeeId on user" });
        const employee = await prisma_1.prisma.employee.update({
            where: { id: employeeId },
            data: {
                addressLine1: req.body.addressLine1 || null,
                addressLine2: req.body.addressLine2 || null,
                city: req.body.city || null,
                state: req.body.state || null,
                zip: req.body.zip ? String(req.body.zip).replace(/\D/g, "") : null,
                ssnLast4: req.body.ssnLast4 ? String(req.body.ssnLast4).replace(/\D/g, "") : null,
            },
            select: {
                id: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
            },
        });
        return res.json({ ok: true, employee });
    }
    catch (e) {
        console.error("PATCH /api/employee/profile failed:", e);
        return res.status(500).json({ error: "Failed to save employee profile" });
    }
});
