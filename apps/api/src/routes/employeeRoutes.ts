import { Router } from "express";
import { prisma } from "../prisma";
import { generatePaystubPdf } from "../services/paystubPdf";
import { requireAuth } from "../middleware/authMiddleware";
import { generateUploadedPaystubPdf } from "../services/uploadedPaystubPdf";
import { sendPaystubEmail } from "../lib/email";
import { PaystubRecord } from "../services/paystubGenerator";

export const employeeRoutes = Router();

employeeRoutes.use(requireAuth);

// local status value (avoid Prisma enum export issues)

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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateISO(d: Date) {
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

function importedRecord(value: any): PaystubRecord {
  return {
    ...value,
    periodStart: new Date(value.periodStart),
    periodEnd: new Date(value.periodEnd),
    payDate: new Date(value.payDate),
  };
}

function importedRange(query: any) {
  const from = String(query.from || "");
  const to = String(query.to || "");
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) return null;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

async function importedContext(employeeId: string, query: any) {
  const range = importedRange(query);
  if (!range) throw Object.assign(new Error("Dates must use YYYY-MM-DD"), { status: 400 });
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { legalName: true, email: true, addressLine1: true, addressLine2: true, city: true, state: true, zip: true, ssnLast4: true, employeeCode: true, payrollSourceName: true, hourlyRateCents: true },
  });
  if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
  if (!employee.payrollSourceName) throw Object.assign(new Error("Your payroll file mapping is awaiting administrator approval"), { status: 409 });
  const periods = await prisma.importedPaystubPeriod.findMany({
    where: { employeeId, ...(Object.keys(range).length ? { periodEnd: range } : {}) },
    orderBy: { periodEnd: "desc" },
    select: { id: true, periodStart: true, periodEnd: true, payDate: true, record: true },
  });
  return { employee, periods, records: periods.map((period) => importedRecord(period.record)) };
}

employeeRoutes.get("/employee/imported-paystubs", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee account is linked" });
    const { employee, periods } = await importedContext(employeeId, req.query);
    res.setHeader("Cache-Control", "no-store, private");
    return res.json({
      employee: { legalName: employee.legalName, employeeCode: employee.employeeCode, mapped: Boolean(employee.payrollSourceName) },
      periods: periods.map(({ id, periodStart, periodEnd, payDate }) => ({ id, periodStart, periodEnd, payDate })),
    });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.message || "Failed to load paystubs" });
  }
});

employeeRoutes.get("/employee/imported-paystubs/pdf", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee account is linked" });
    const { employee, records } = await importedContext(employeeId, req.query);
    if (!records.length) return res.status(404).json({ error: "No paystubs are available for that date range" });
    if (!employee.addressLine1 || !employee.ssnLast4 || !employee.employeeCode) return res.status(409).json({ error: "Complete your address and ask payroll to assign your employee code" });
    if (employee.hourlyRateCents <= 0) return res.status(409).json({ error: "Your hourly pay rate has not been configured. Please contact Wezen Staffing." });
    const regularRate = employee.hourlyRateCents / 100;
    const pdf = await generateUploadedPaystubPdf(employee.legalName, {
      addressLine1: employee.addressLine1,
      addressLine2: [employee.addressLine2, [employee.city, employee.state].filter(Boolean).join(", "), employee.zip].filter(Boolean).join(" "),
      ssnLast4: employee.ssnLast4,
      employeeId: employee.employeeCode,
    }, records, { regular: regularRate, overtime: regularRate * 1.5, doubleTime: regularRate * 2, holiday: regularRate * 1.5 });
    await prisma.paystubAccessLog.create({ data: { employeeId, action: "DOWNLOAD", periodCount: records.length, ipAddress: req.ip || null, fromDate: records[records.length - 1]?.periodStart, toDate: records[0]?.periodEnd } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="wezen-paystubs-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.setHeader("Cache-Control", "no-store, private");
    return res.send(pdf);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.message || "Failed to generate paystubs" });
  }
});

employeeRoutes.post("/employee/imported-paystubs/email", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee account is linked" });
    const { employee, records } = await importedContext(employeeId, req.body || {});
    if (!records.length) return res.status(404).json({ error: "No paystubs are available for that date range" });
    if (!employee.addressLine1 || !employee.ssnLast4 || !employee.employeeCode) return res.status(409).json({ error: "Complete your address and ask payroll to assign your employee code" });
    if (employee.hourlyRateCents <= 0) return res.status(409).json({ error: "Your hourly pay rate has not been configured. Please contact Wezen Staffing." });
    const regularRate = employee.hourlyRateCents / 100;
    const pdf = await generateUploadedPaystubPdf(employee.legalName, {
      addressLine1: employee.addressLine1,
      addressLine2: [employee.addressLine2, [employee.city, employee.state].filter(Boolean).join(", "), employee.zip].filter(Boolean).join(" "),
      ssnLast4: employee.ssnLast4,
      employeeId: employee.employeeCode,
    }, records, { regular: regularRate, overtime: regularRate * 1.5, doubleTime: regularRate * 2, holiday: regularRate * 1.5 });
    const year = records[0].periodEnd.getUTCFullYear();
    const fileName = `wezen-paystubs-${year}.pdf`;
    await sendPaystubEmail({ to: employee.email, employeeName: employee.legalName, year, fileName, pdf });
    await prisma.paystubAccessLog.create({ data: { employeeId, action: "EMAIL", periodCount: records.length, ipAddress: req.ip || null, fromDate: records[records.length - 1]?.periodStart, toDate: records[0]?.periodEnd } });
    return res.json({ ok: true, email: employee.email, payPeriods: records.length });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.message || "Failed to email paystubs" });
  }
});

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
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const { from, to } = req.query as { from?: string; to?: string };

    const where: any = {
  employeeId,
  status: { in: ["APPROVED", "LOCKED"] },
};
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
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const { from, to } = req.query as { from?: string; to?: string };

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const where: any = {
  employeeId,
  status: { in: ["APPROVED", "LOCKED"] },
};

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

    let totalWorkedMinutes = 0;
let totalBreakMinutes = 0;
let totalPayableMinutes = 0;

let regularMinutes = 0;
let overtimeMinutes = 0;
let doubleMinutes = 0;

for (const e of entries as any[]) {
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

const grossPayCents =
  regularPayCents +
  overtimePayCents +
  doublePayCents;

const payableHours =
  Math.round((totalPayableMinutes / 60) * 100) / 100;

// ---- Payroll adjustments (same date window as entries) ----

const adjWhere: any = { employeeId };

if (from || to) {
  adjWhere.createdAt = {};
  if (from) adjWhere.createdAt.gte = startOfDay(from);
  if (to) adjWhere.createdAt.lt = startOfNextDay(to);
}

const adjustments = await prisma.payrollAdjustment.findMany({
  where: adjWhere,
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    createdAt: true,
    amountCents: true,
    reason: true,
  },
});

const adjustmentsCents = adjustments.reduce(
  (sum, a) => sum + Number(a.amountCents ?? 0),
  0
);

// ---- Loan deductions (same date window as entries) ----

const loanWhere: any = { employeeId };

if (from || to) {
  if (from) {
    loanWhere.periodStart = { gte: startOfDay(from) };
  }
  if (to) {
    loanWhere.periodEnd = { lt: startOfNextDay(to) };
  }
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
  } catch (e) {
    console.error("GET /api/employee/pay-summary failed:", e);
    return res.status(500).json({ error: "Failed to load pay summary" });
  }
});

employeeRoutes.get("/employee/profile", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const employee = await prisma.employee.findUnique({
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

    if (!employee) return res.status(404).json({ error: "Employee not found" });

    return res.json({ employee });
  } catch (e) {
    console.error("GET /api/employee/profile failed:", e);
    return res.status(500).json({ error: "Failed to load employee profile" });
  }
});

employeeRoutes.get("/employee/paystub", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const employee = await prisma.employee.findUnique({
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

    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const entryWhere: any = {
      employeeId,
      status: { in: ["APPROVED", "LOCKED"] },
      workDate: {
        gte: startOfDay(from),
        lt: startOfNextDay(to),
      },
    };

    const entries = await prisma.timeEntry.findMany({
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

for (const e of entries as any[]) {
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

const grossPayCents =
  regularPayCents +
  overtimePayCents +
  doublePayCents;

const payableHours =
  Math.round((totalPayableMinutes / 60) * 100) / 100;

    const adjWhere: any = {
      employeeId,
      createdAt: {
        gte: startOfDay(from),
        lt: startOfNextDay(to),
      },
    };

    const adjustments = await prisma.payrollAdjustment.findMany({
      where: adjWhere,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        amountCents: true,
        reason: true,
      },
    });

    const adjustmentsCents = adjustments.reduce(
      (sum, a) => sum + Number(a.amountCents ?? 0),
      0
    );

    const loanWhere: any = {
      employeeId,
      periodStart: { gte: startOfDay(from) },
      periodEnd: { lt: startOfNextDay(to) },
    };

    const loanDeductions = await prisma.loanDeduction.findMany({
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

    const loanDeductionCents = loanDeductions.reduce(
      (sum, d) => sum + Number(d.amountCents ?? 0),
      0
    );

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
  } catch (e) {
    console.error("GET /api/employee/paystub failed:", e);
    return res.status(500).json({ error: "Failed to load paystub" });
  }
});

employeeRoutes.get("/employee/paystub/pdf", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      return res.status(400).json({ error: "from and to required" });
    }

    const employee = await prisma.employee.findUnique({
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

    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const entryWhere: any = {
      employeeId,
      status: { in: ["APPROVED", "LOCKED"] },
      workDate: {
        gte: startOfDay(from),
        lt: startOfNextDay(to),
      },
    };

    const entries = await prisma.timeEntry.findMany({
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

    for (const e of entries as any[]) {
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

    const grossPayCents =
      regularPayCents +
      overtimePayCents +
      doublePayCents;

    const payableHours =
      Math.round((totalPayableMinutes / 60) * 100) / 100;

    const adjustments = await prisma.payrollAdjustment.findMany({
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

    const adjustmentsCents = adjustments.reduce(
      (sum, a) => sum + Number(a.amountCents ?? 0),
      0
    );

    const loanDeductions = await prisma.loanDeduction.findMany({
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

    const loanDeductionCents = loanDeductions.reduce(
      (sum, d) => sum + Number(d.amountCents ?? 0),
      0
    );

    const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;
    const payDate = formatDateISO(addDays(startOfDay(to), 5));

    const pdf = await generatePaystubPdf({
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="paystub-${from}-${to}.pdf"`
    );

    return res.send(pdf);
  } catch (e) {
    console.error("GET /api/employee/paystub/pdf failed:", e);
    return res.status(500).json({ error: "Failed to generate paystub pdf" });
  }
});

employeeRoutes.patch("/employee/profile", async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(409).json({ error: "Your payroll account setup is not complete. If you just activated it, please sign out and sign in again. Otherwise, contact Wezen Staffing." });

    const employee = await prisma.employee.update({
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
  } catch (e) {
    console.error("PATCH /api/employee/profile failed:", e);
    return res.status(500).json({ error: "Failed to save employee profile" });
  }
});
