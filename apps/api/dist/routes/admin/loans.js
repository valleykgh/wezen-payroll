"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.get("/loans", async (req, res) => {
    try {
        const employeeId = String(req.query.employeeId || "").trim();
        const where = {};
        if (employeeId)
            where.employeeId = employeeId;
        const loans = await prisma_1.prisma.employeeLoan.findMany({
            where,
            orderBy: [{ createdAt: "asc" }],
            include: {
                deductions: true,
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        active: true,
                    },
                },
            },
        });
        const mapped = loans.map((l) => {
            const deductedCents = (l.deductions || []).reduce((s, d) => s + Number(d.amountCents ?? 0), 0);
            const computedOutstanding = Math.max(0, Number(l.principalCents ?? 0) - deductedCents);
            return {
                id: l.id,
                employeeId: l.employeeId,
                employee: l.employee,
                amountCents: Number(l.principalCents ?? 0),
                principalCents: Number(l.principalCents ?? 0),
                weeklyDeductionCents: Number(l.weeklyDeductionCents ?? 0),
                weeklyDeductionLocked: Boolean(l.weeklyDeductionLocked),
                deductedCents,
                outstandingCents: computedOutstanding,
                note: l.note ?? null,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            };
        });
        return res.json(employeeId ? { employeeId, loans: mapped } : { loans: mapped });
    }
    catch (e) {
        console.error("GET /api/admin/loans failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load loans" });
    }
});
router.get("/loans/outstanding", async (req, res) => {
    try {
        const employeeId = String(req.query.employeeId || "");
        if (!employeeId)
            return res.status(400).json({ error: "employeeId required" });
        const loans = await prisma_1.prisma.employeeLoan.findMany({
            where: { employeeId },
            include: { deductions: true },
            orderBy: { createdAt: "asc" },
        });
        const totalPrincipalCents = loans.reduce((sum, l) => sum + Number(l.principalCents ?? 0), 0);
        const totalDeductedCents = loans.reduce((sum, l) => {
            const d = (l.deductions || []).reduce((s, x) => s + Number(x.amountCents ?? 0), 0);
            return sum + d;
        }, 0);
        const outstandingCents = Math.max(0, totalPrincipalCents - totalDeductedCents);
        return res.json({
            employeeId,
            outstandingCents,
            totalPrincipalCents,
            totalDeductedCents,
            loans: loans.map((l) => ({
                id: l.id,
                principalCents: Number(l.principalCents ?? 0),
                weeklyDeductionCents: Number(l.weeklyDeductionCents ?? 0),
                weeklyDeductionLocked: Boolean(l.weeklyDeductionLocked),
                createdAt: l.createdAt,
            })),
        });
    }
    catch (e) {
        console.error("GET /api/admin/loans/outstanding failed:", e);
        return res.status(500).json({ error: "Failed to load outstanding loan" });
    }
});
router.post("/loans", async (req, res) => {
    try {
        const { employeeId, amountCents, weeklyDeductionCents, note } = req.body || {};
        if (!employeeId)
            return res.status(400).json({ error: "employeeId required" });
        const amt = Number(amountCents);
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ error: "amountCents must be a positive integer" });
        }
        const weekly = Number(weeklyDeductionCents ?? 0);
        if (!Number.isFinite(weekly) || weekly < 0) {
            return res.status(400).json({ error: "weeklyDeductionCents must be >= 0" });
        }
        const emp = await prisma_1.prisma.employee.findUnique({
            where: { id: String(employeeId) },
            select: { id: true },
        });
        if (!emp)
            return res.status(404).json({ error: "Employee not found" });
        const loan = await prisma_1.prisma.employeeLoan.create({
            data: {
                employeeId: String(employeeId),
                principalCents: Math.round(amt),
                outstandingCents: Math.round(amt),
                note: note ? String(note) : null,
                weeklyDeductionCents: Math.round(weekly),
                weeklyDeductionLocked: false,
            },
            select: {
                id: true,
                employeeId: true,
                principalCents: true,
                outstandingCents: true,
                weeklyDeductionCents: true,
                weeklyDeductionLocked: true,
                note: true,
                createdAt: true,
            },
        });
        return res.json({ loan });
    }
    catch (e) {
        console.error("POST /api/admin/loans failed:", e);
        return res.status(400).json({ error: e?.message || "Failed to create loan" });
    }
});
router.patch("/loans/:loanId/weekly-deduction", async (req, res) => {
    try {
        (0, _shared_1.requireLoanPin)(req);
        const loanId = String(req.params.loanId || "");
        const { weeklyDeductionCents, lock } = req.body || {};
        const loan = await prisma_1.prisma.employeeLoan.findUnique({
            where: { id: loanId },
        });
        if (!loan) {
            return res.status(404).json({ error: "Loan not found" });
        }
        const weekly = Number(weeklyDeductionCents);
        if (!Number.isFinite(weekly) || weekly < 0) {
            return res.status(400).json({ error: "weeklyDeductionCents must be >= 0" });
        }
        const updated = await prisma_1.prisma.employeeLoan.update({
            where: { id: loanId },
            data: {
                weeklyDeductionCents: Math.round(weekly),
                weeklyDeductionLocked: typeof lock === "boolean" ? lock : loan.weeklyDeductionLocked,
            },
        });
        return res.json({ loan: updated });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("PATCH /api/admin/loans/:loanId/weekly-deduction failed:", e);
        return res
            .status(status)
            .json({ error: e?.message || "Failed to update weekly deduction" });
    }
});
router.post("/loans/deduct", async (req, res) => {
    try {
        (0, _shared_1.requireLoanPin)(req);
        const { employeeId, amountCents } = req.body || {};
        const cents = Number(amountCents);
        if (!employeeId)
            return res.status(400).json({ error: "employeeId required" });
        if (!Number.isFinite(cents) || cents <= 0) {
            return res.status(400).json({ error: "amountCents must be > 0" });
        }
        const loans = await prisma_1.prisma.employeeLoan.findMany({
            where: { employeeId },
            orderBy: { createdAt: "asc" },
            include: { deductions: true },
        });
        let remaining = cents;
        const created = [];
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        for (const loan of loans) {
            const loanRemaining = Number(loan.outstandingCents ?? 0);
            if (loanRemaining <= 0)
                continue;
            const apply = Math.min(remaining, loanRemaining);
            const d = await prisma_1.prisma.loanDeduction.create({
                data: {
                    employeeId,
                    loanId: loan.id,
                    amountCents: apply,
                    periodStart,
                    periodEnd,
                    note: "Manual admin deduction",
                },
            });
            await prisma_1.prisma.employeeLoan.update({
                where: { id: loan.id },
                data: { outstandingCents: { decrement: apply } },
            });
            created.push(d);
            remaining -= apply;
            if (remaining <= 0)
                break;
        }
        if (created.length === 0) {
            return res.status(400).json({ error: "No outstanding loan to deduct from" });
        }
        return res.json({ ok: true, created, unappliedCents: remaining });
    }
    catch (e) {
        console.error("POST /admin/loans/deduct failed:", e);
        return res.status(500).json({ error: "Failed to deduct loan" });
    }
});
router.post("/loans/run-deductions", async (req, res) => {
    try {
        const { periodStart, periodEnd } = req.body || {};
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ error: "periodStart and periodEnd required (YYYY-MM-DD)" });
        }
        const start = new Date(`${periodStart}T00:00:00.000Z`);
        const end = new Date(`${periodEnd}T23:59:59.999Z`);
        const loans = await prisma_1.prisma.employeeLoan.findMany({
            where: {
                outstandingCents: { gt: 0 },
                weeklyDeductionCents: { gt: 0 },
            },
            orderBy: { createdAt: "asc" },
        });
        const created = [];
        for (const loan of loans) {
            const amount = Math.min(Number(loan.weeklyDeductionCents), Number(loan.outstandingCents));
            if (amount <= 0)
                continue;
            const already = await prisma_1.prisma.loanDeduction.findFirst({
                where: {
                    loanId: loan.id,
                    periodStart: start,
                    periodEnd: end,
                },
                select: { id: true },
            });
            if (already)
                continue;
            const d = await prisma_1.prisma.loanDeduction.create({
                data: {
                    employeeId: loan.employeeId,
                    loanId: loan.id,
                    amountCents: amount,
                    periodStart: start,
                    periodEnd: end,
                },
            });
            await prisma_1.prisma.employeeLoan.update({
                where: { id: loan.id },
                data: { outstandingCents: { decrement: amount } },
            });
            created.push(d);
        }
        return res.json({
            ok: true,
            periodStart,
            periodEnd,
            deductionsCreated: created.length,
            deductions: created,
        });
    }
    catch (e) {
        console.error("POST /api/admin/loans/run-deductions failed:", e);
        return res.status(500).json({ error: "Failed to run deductions" });
    }
});
exports.default = router;
