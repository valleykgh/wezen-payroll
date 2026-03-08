import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/authMiddleware";

export const employeeRoutes = Router();

employeeRoutes.use(requireAuth);

// local status value (avoid Prisma enum export issues)
const APPROVED_STATUS = "APPROVED" as const;

type BreakRow = {
  startTime: Date;
  endTime: Date;
  minutes: number;
};

function startOfDay(dateISO: string) {
  // dateISO: "YYYY-MM-DD"
  return new Date(`${dateISO}T00:00:00`);
}

function startOfNextDay(dateISO: string) {
  const d = startOfDay(dateISO);
  d.setDate(d.getDate() + 1);
  return d;
}

function sumBreakMinutesFromEntry(e: any): number {
  const breaks: Array<{ minutes: number | null }> = Array.isArray(e.breaks) ? e.breaks : [];
  if (breaks.length > 0) {
    return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
  }
  return Number(e.breakMinutes ?? 0);
}

async function computeLoanDeductionCentsForPeriod(employeeId: string, from?: string, to?: string) {
  // only count loans that still have outstanding > 0
  const loans = await prisma.employeeLoan.findMany({
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

    if (outstanding <= 0) continue;

    const weekly = Number(l.weeklyDeductionCents ?? 0);
    if (weekly <= 0) continue;

    const raw = deductOnce ? weekly : weekly; // we'll expand this in Step 5C
    const applied = Math.min(outstanding, raw);

    total += applied;
  }

  return total;
}

employeeRoutes.get("/employee/time-entries", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employeeId on user" });

    const { from, to } = req.query as { from?: string; to?: string };

    const where: any = { employeeId, status: APPROVED_STATUS };

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDay(from);
      if (to) where.workDate.lt = startOfNextDay(to); // IMPORTANT: exclusive end
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: { workDate: "desc" },
      include: {
        breaks: { select: { startTime: true, endTime: true, minutes: true } },
      },
    });

    const entriesWithComputed = entries.map((e: any) => {
      const breaks: BreakRow[] = Array.isArray(e.breaks) ? e.breaks : [];
      const computedBreakMinutes =
        breaks.length > 0
          ? breaks.reduce((sum: number, b: any) => sum + Number(b.minutes ?? 0), 0)
          : Number(e.breakMinutes ?? 0);

      return { ...e, computedBreakMinutes };
    });

    res.json({ entries: entriesWithComputed });
  } catch (e) {
    console.error("GET /api/employee/time-entries failed:", e);
    res.status(500).json({ error: "Failed to load time entries" });
  }
});

employeeRoutes.get("/employee/pay-summary", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employeeId on user" });

    const { from, to } = req.query as { from?: string; to?: string };

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const where: any = { employeeId, status: APPROVED_STATUS };

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDay(from);
      if (to) where.workDate.lt = startOfNextDay(to); // IMPORTANT: exclusive end
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      select: {
        id: true,
        workDate: true,
        minutesWorked: true, // WORKED minutes
        breakMinutes: true,  // fallback only
        breaks: { select: { minutes: true } },
      },
      orderBy: { workDate: "asc" },
    });

    const totalWorkedMinutes = entries.reduce((sum, e: any) => sum + Number(e.minutesWorked ?? 0), 0);

    const totalBreakMinutes = entries.reduce((sum, e: any) => sum + sumBreakMinutesFromEntry(e), 0);

    const totalPayableMinutes = entries.reduce((sum, e: any) => {
      const worked = Number(e.minutesWorked ?? 0);
      const breaks = sumBreakMinutesFromEntry(e);
      return sum + Math.max(0, worked - breaks);
    }, 0);
// hours for display (0-100 decimal)
const payableHours = Math.round((totalPayableMinutes / 60) * 100) / 100;

// payroll-safe cents calculation (integer math)
const grossPayCents = Math.round((totalPayableMinutes * employee.hourlyRateCents) / 60);

// ---- Payroll adjustments (same date window as entries) ----
const adjWhere: any = { employeeId };

if (from || to) {
  adjWhere.workDate = {};
  if (from) adjWhere.workDate.gte = startOfDay(from);
  if (to) adjWhere.workDate.lt = startOfNextDay(to); // exclusive end, same as entries
}

const adjustments = await prisma.payrollAdjustment.findMany({
  where: adjWhere,
  orderBy: { workDate: "asc" },
  select: {
    id: true,
    workDate: true,
    amountCents: true,
  },
});

const adjustmentsCents = adjustments.reduce(
  (sum, a) => sum + Number(a.amountCents ?? 0),
  0
);

// ---- Loan deductions (same date window as entries) ----
const loanWhere: any = { employeeId };

if (from || to) {
  loanWhere.workDate = {};
  if (from) loanWhere.workDate.gte = startOfDay(from);
  if (to) loanWhere.workDate.lt = startOfNextDay(to); // exclusive end
}
const loanDeductions = await prisma.loanDeduction.findMany({
  where: loanWhere,
  select: { amountCents: true },
});

const loanDeductionCents = loanDeductions.reduce(
  (sum, d) => sum + Number(d.amountCents ?? 0),
  0
);

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
    totalBreakMinutes: totalBreakMinutes,
    payableMinutes: totalPayableMinutes,
    totalHours: payableHours,
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
  } catch (e) {
    console.error("GET /api/employee/pay-summary failed:", e);
    return res.status(500).json({ error: "Failed to load pay summary" });
  }
});
