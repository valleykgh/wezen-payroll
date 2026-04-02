import express from "express";
import { prisma } from "../../prisma";
import {
  SHIFT_TYPE,
  TIME_ENTRY_STATUS,
  Punch,
  BreakInput,
  Segment,
  assertEditableNotLocked,
  assertFacilityRateExists,
  buildPunchKey,
  calculateTimeEntryTotals,
  computeBreakRows,
  computeWorkedMinutes,
  fmtHHMM,
  minutesToDecimalHours,
  splitDailyBuckets,
  startOfDayUTC,
  startOfNextDayUTC,
  sumBreakMinutesFromEntry,
  validateTwoSegmentContinuity,
  getBillableWorkRows,
  calculatePayCents,
  calculateBillCents,
  getHolidayRule,
  calculatePayCentsWithRule,
  calculateBillCentsWithRule,
} from "./_shared";

const router = express.Router();

function mapShiftTypeToDb(shiftType: string) {
  if (shiftType === "AM+PM") return "AM_PM";
  if (shiftType === "PM+NOC") return "PM_NOC";
  if (shiftType === "NOC+AM") return "NOC_AM";
  return shiftType;
}

function mapShiftTypeFromDb(shiftType?: string | null) {
  if (shiftType === "AM_PM") return "AM+PM";
  if (shiftType === "PM_NOC") return "PM+NOC";
  if (shiftType === "NOC_AM") return "NOC+AM";
  return shiftType || "";
}

async function findFacilityRateForEntry(e: any) {
  const facilityId = String(e.facilityId || "").trim();
  const workDate = e.workDate ? new Date(e.workDate) : null;
  const employeeTitle = String(e.employee?.title || "").trim();

  if (!facilityId || !workDate || !employeeTitle) return null;

  const rate = await prisma.facilityRate.findFirst({
    where: {
      facilityId,
      title: employeeTitle as any,
      effectiveFrom: {
        lte: workDate,
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      id: true,
      title: true,
      effectiveFrom: true,
      regRateCents: true,
      otRateCents: true,
      dtRateCents: true,
    },
  });

  return rate;
}

function getPayrollWeekBounds(workDateValue: Date | string) {
  const base =
    workDateValue instanceof Date
      ? new Date(workDateValue)
      : new Date(`${String(workDateValue).slice(0, 10)}T00:00:00.000Z`);

  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const day = d.getUTCDay(); // Sun=0, Mon=1
  const daysFromMonday = day === 0 ? 6 : day - 1;

  const periodStart = new Date(d);
  periodStart.setUTCDate(periodStart.getUTCDate() - daysFromMonday);

  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);

  return { periodStart, periodEnd };
}

function centsToMoney(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

router.get("/time-entries", async (req, res) => {
  try {
    const {
      employeeId,
      from,
      to,
      status,
      q,
      facilityId,
      page = "1",
      pageSize = "25",
    } = req.query as Record<string, string>;

    const includeMissedAdjustments =
      String(req.query.includeMissedAdjustments || "false") === "true";

    const take = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (employeeId) where.employeeId = String(employeeId);

    const employeeIds = String(req.query.employeeIds || "").trim();
    if (!employeeId && employeeIds) {
      const ids = employeeIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length) where.employeeId = { in: ids };
    }

    if (facilityId) {
      where.facilityId = String(facilityId);
    }

    if (status) where.status = String(status);

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDayUTC(from);
      if (to) where.workDate.lt = startOfNextDayUTC(to);
    }

    if (q && q.trim()) {
      const s = q.trim();
      where.employee = {
        OR: [
          { legalName: { contains: s, mode: "insensitive" } },
          { preferredName: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
        ],
      };
    }

    const [total, entries] = await Promise.all([
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        skip,
        take,
        select: {
          id: true,
          employeeId: true,
          facilityId: true,
          workDate: true,
          status: true,
          shiftType: true,
          minutesWorked: true,
          breakMinutes: true,
          startTime: true,
          endTime: true,
          notes: true,
          punchKey: true,
          punchesJson: true,
          breaksJson: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              legalName: true,
              preferredName: true,
              email: true,
              hourlyRateCents: true,
              billingRole: true,
              title: true,
            },
          },
          facility: {
            select: {
              id: true,
              name: true,
            },
          },
          breaks: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              minutes: true,
            },
          },
        } as any,
      }),
    ]);

    const entriesWithComputed = await Promise.all(
      entries.map(async (e: any) => {
        const breaks = Array.isArray(e.breaks) ? e.breaks : [];
        if (breaks.length > 0) {
  e.breaksJson = breaks.map((b: any) => ({
    startTime: b.startTime,
    endTime: b.endTime,
  }));
}
        const computedBreakMinutes =
          breaks.length > 0
            ? breaks.reduce((sum: number, b: any) => sum + Number(b.minutes ?? 0), 0)
            : Number(e.breakMinutes ?? 0);

        const workedMinutes = Number(e.minutesWorked ?? 0);
        const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);

        const b = splitDailyBuckets(payableMinutes);

        const buckets = {
          regularMinutes: b.regularMinutes,
          overtimeMinutes: b.overtimeMinutes,
          doubleMinutes: b.doubleMinutes,
          regular_decimal: minutesToDecimalHours(b.regularMinutes),
          overtime_decimal: minutesToDecimalHours(b.overtimeMinutes),
          double_decimal: minutesToDecimalHours(b.doubleMinutes),
        };

        const facilityRate = await findFacilityRateForEntry(e);

const marker = `TIME_ENTRY_PAY_NOW:${e.id}`;

const { periodStart, periodEnd } = getPayrollWeekBounds(e.workDate);

const finalizedRunForWeek = await prisma.payrollRun.findFirst({
  where: {
    periodStart,
    periodEnd,
    status: "FINALIZED",
  },
  select: {
    id: true,
  },
});

const snapshotInFinalizedWeek = finalizedRunForWeek
  ? await prisma.payrollRunEntrySnapshot.findFirst({
      where: {
        payrollRunId: finalizedRunForWeek.id,
        timeEntryId: e.id,
      },
      select: {
        id: true,
      },
    })
  : null;


const paidNowLedgerRows = await prisma.employeePayrollLedger.findMany({
  where: {
    employeeId: e.employeeId,
    note: {
      contains: marker,
    },
  },
  orderBy: [{ createdAt: "asc" }],
  select: {
    id: true,
    type: true,
    amountCents: true,
    note: true,
    createdAt: true,
  },
});

const paidNow = paidNowLedgerRows.length > 0;
const paidViaPayrollWeek = !!snapshotInFinalizedWeek && !paidNow;
const addedAfterFinalizedWeek = !!finalizedRunForWeek && !snapshotInFinalizedWeek && !paidNow;
const paidNowPaymentRow = paidNowLedgerRows.find(
  (r) => r.type === "EARLY_PAY" && Number(r.amountCents || 0) < 0
);

const paidNowAmountCents = paidNowPaymentRow
  ? Math.abs(Number(paidNowPaymentRow.amountCents || 0))
  : 0;

const paidNowAt =
  paidNowPaymentRow?.createdAt || paidNowLedgerRows[0]?.createdAt || null;

const paidNowNote =
  paidNowPaymentRow?.note || paidNowLedgerRows[0]?.note || null;

const holidayRule = await getHolidayRule(e.workDate);

return {
  ...e,
  shiftType: mapShiftTypeFromDb(String(e.shiftType || "")),
  computedBreakMinutes,
  payableMinutes,
  calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
  buckets,
  facilityRate,
  paidNow,
paidNowAt,
paidNowAmountCents,
paidNowNote,
paidViaPayrollWeek,
addedAfterFinalizedWeek,
holidayName: holidayRule?.name || null,
holidayMultiplier: holidayRule?.payMultiplier || 1,
isHoliday: holidayRule?.isHoliday || false,
};
      })
    );

    let combinedEntries: any[] = [...entriesWithComputed];

    if (includeMissedAdjustments && from && to) {
      const missedRows = await getBillableWorkRows({
        prisma,
        facilityId: facilityId ? String(facilityId) : undefined,
        from: startOfDayUTC(from),
        toExclusive: startOfNextDayUTC(to),
      });

      const adjustmentRows = missedRows
  .filter((r: any) => r.sourceType === "PAYROLL_ADJUSTMENT")
  .map((r: any) => ({
    id: r.sourceId,
    employeeId: r.employeeId,
    facilityId: r.facilityId,
    workDate: r.workDate,
    createdAt: r.createdAt,
    status: "APPROVED",
    shiftType: r.shiftType || "ADJUSTMENT",
    minutesWorked: r.minutesWorked,
    breakMinutes: r.breakMinutes,
    payableMinutes: r.payableMinutes,
    computedBreakMinutes: 0,
    calculatedHours_decimal: minutesToDecimalHours(r.payableMinutes || 0),
    notes: r.notes,
    employee: r.employee,
    facility: r.facility,
    breaks: [],
    punchesJson: r.punchesJson || null,
    breaksJson: r.breaksJson || null,
    billAmountCents: r.billAmountCents || 0,   // <-- add this
    amountCents: r.amountCents || 0,           // <-- useful too
    facilityRate: null,
    buckets: {
      regularMinutes: r.regularMinutes || 0,
      overtimeMinutes: r.overtimeMinutes || 0,
      doubleMinutes: r.doubleMinutes || 0,
      regular_decimal: minutesToDecimalHours(r.regularMinutes || 0),
      overtime_decimal: minutesToDecimalHours(r.overtimeMinutes || 0),
      double_decimal: minutesToDecimalHours(r.doubleMinutes || 0),
    },
    isMissedAdjustment: true,
  }));

      combinedEntries = [...entriesWithComputed, ...adjustmentRows].sort(
        (a: any, b: any) =>
          new Date(b.workDate).getTime() - new Date(a.workDate).getTime()
      );
    }

    return res.json({
      page: pageNum,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
      entries: combinedEntries,
    });
  } catch (e) {
    console.error("GET /api/admin/time-entries failed:", e);
    return res.status(500).json({ error: "Failed to list time entries" });
  }
});

router.get("/time-entry/calc", async (req, res) => {
  try {
    const workDate = String(req.query.workDate || "");
    const shiftType = String(req.query.shiftType || "");
    const punchesRaw = String(req.query.punches || "[]");
    const breaksRaw = String(req.query.breaks || "[]");

    if (!workDate || !shiftType) {
      return res.status(400).json({ error: "workDate and shiftType required" });
    }

    const punches = JSON.parse(punchesRaw);
    const breaks = JSON.parse(breaksRaw);

    const r = computeWorkedMinutes(workDate, punches);
    const computedBreaks = computeBreakRows(workDate, breaks);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
    const payableMinutes = Math.max(0, r.workedMinutes - breakMinutes);
    const buckets = splitDailyBuckets(payableMinutes);
    const holidayRule = await getHolidayRule(workDate);
    const warnings: string[] = [];

    let billing: {
  hasRate: boolean;
  regRateCents: number;
  otRateCents: number;
  dtRateCents: number;
  billAmountCents: number;
} | null = null;

const employeeId = String(req.query.employeeId || "").trim();
const facilityId = String(req.query.facilityId || "").trim();

if (employeeId && facilityId) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      title: true,
    },
  });

  if (employee?.title) {
    const facilityRate = await prisma.facilityRate.findFirst({
      where: {
        facilityId,
        title: String(employee.title) as any,
        effectiveFrom: {
          lte: new Date(`${workDate}T00:00:00.000Z`),
        },
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });

    if (facilityRate) {
      const billAmountCents = calculateBillCentsWithRule({
        regularMinutes: buckets.regularMinutes,
        overtimeMinutes: buckets.overtimeMinutes,
        doubleMinutes: buckets.doubleMinutes,
        regRateCents: Number(facilityRate.regRateCents || 0),
        otRateCents: Number(facilityRate.otRateCents || 0),
        dtRateCents: Number(facilityRate.dtRateCents || 0),
        holidayRule,
      });

      billing = {
        hasRate: true,
        regRateCents: Number(facilityRate.regRateCents || 0),
        otRateCents: Number(facilityRate.otRateCents || 0),
        dtRateCents: Number(facilityRate.dtRateCents || 0),
        billAmountCents,
      };
    } else {
      billing = {
        hasRate: false,
        regRateCents: 0,
        otRateCents: 0,
        dtRateCents: 0,
        billAmountCents: 0,
      };
    }
  }
}    

    if (breakMinutes > r.workedMinutes) warnings.push("Break minutes exceed worked minutes");

    return res.json({
      input: {
        workDate,
        shiftType,
        workedMinutes: r.workedMinutes,
        breakMinutes,
        payableMinutes,
      },
      display: {
        calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
      },
      buckets: {
        regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
        overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
        double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
      },
      holiday: {
  isHoliday: holidayRule.isHoliday,
  name: holidayRule.name,
  payMultiplier: holidayRule.payMultiplier,
  billMultiplier: holidayRule.billMultiplier,
  appliesToRegularOnly: holidayRule.appliesToRegularOnly,
},
     billing, 
     warnings,
    });
  } catch (e: any) {
    console.error("GET /api/admin/time-entry/calc failed:", e);
    return res.status(400).json({ error: e?.message || "Invalid input" });
  }
});

router.get("/time-entry/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            hourlyRateCents: true,
            billingRole: true,
            title: true,
          },
        },
        facility: { select: { id: true, name: true } },
        breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
      },
    });

    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    if (!(entry as any).punchesJson && entry.startTime && entry.endTime) {
      (entry as any).punchesJson = [
        {
          clockIn: entry.startTime,
          clockOut: entry.endTime,
        },
      ];
    }

   if (entry.breaks && entry.breaks.length > 0) {
  (entry as any).breaksJson = entry.breaks.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
  }));
}  
  
return res.json({
  entry: {
    ...entry,
    shiftType: mapShiftTypeFromDb(String(entry.shiftType || "")),
  },
});  
} catch (e: any) {
    console.error("GET /api/admin/time-entry/:id failed:", e);
    return res.status(500).json({ error: "Failed to load time entry" });
  }
});

router.post("/time-entry", async (req, res) => {
  try {
    const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};

    if (!facilityId) return res.status(400).json({ error: "facilityId required" });
    if (!employeeId || !workDate || !shiftType) {
      return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
    }
    if (!Object.values(SHIFT_TYPE).includes(shiftType)) {
      return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
    }
   
        const hasSecondPunch =
      Array.isArray(punches) &&
      punches.length >= 2 &&
      String(punches[1]?.clockIn || "").trim() &&
      String(punches[1]?.clockOut || "").trim();

    const isCombinedShiftType =
      shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM";

    if (hasSecondPunch && !isCombinedShiftType) {
      return res.status(400).json({
        error:
          "Two-shift punches were entered, but Shift Type is not combined. Please use AM+PM, PM+NOC, or NOC+AM.",
      });
    }

    if (!hasSecondPunch && isCombinedShiftType) {
      return res.status(400).json({
        error:
          "Combined Shift Type selected, but second-shift punches are missing.",
      });
    }

    await assertFacilityRateExists({
      employeeId: String(employeeId),
      facilityId: String(facilityId),
      workDate: String(workDate),
    });

    const emp = await prisma.employee.findUnique({
      where: { id: String(employeeId) },
    });

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const ws = String(workDate);


    let workedMinutes = 0;
let startTime: Date | null = null;
let endTime: Date | null = null;
let shiftTypeForDb: any = "AM";

if (Array.isArray(segments) && segments.length === 2) {
  const s1 = segments[0] as Segment;
  const s2 = segments[1] as Segment;

  if (!s1?.shift || !s2?.shift) {
    return res.status(400).json({ error: "segments[].shift required" });
  }
  if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
    return res.status(400).json({ error: "segments[].punches required" });
  }

  const combined = `${s1.shift}+${s2.shift}`;
  if (combined !== shiftType) {
    return res.status(400).json({
      error: `shiftType must match segments order. Expected ${combined}`,
    });
  }

  const a = computeWorkedMinutes(ws, s1.punches);
  const b = computeWorkedMinutes(ws, s2.punches);

  validateTwoSegmentContinuity(
    { shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut },
    { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut }
  );

  workedMinutes = a.workedMinutes + b.workedMinutes;
  startTime = a.firstIn;
  endTime = b.lastOut;

  // ✅ KEEP COMBINED SHIFT (PM+NOC etc)
shiftTypeForDb = mapShiftTypeToDb(shiftType) as any;
} else {
  if (!Array.isArray(punches) || punches.length === 0) {
    return res.status(400).json({
      error: "punches[] required (or provide segments[] length=2)",
    });
  }

  const r = computeWorkedMinutes(ws, punches as Punch[]);
  workedMinutes = r.workedMinutes;
  startTime = r.firstIn;
  endTime = r.lastOut;

  shiftTypeForDb = mapShiftTypeToDb(shiftType) as any;
}

    const computedBreaks = computeBreakRows(ws, Array.isArray(breaks) ? (breaks as BreakInput[]) : []);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);

    if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
      return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
    }

    let createdById: string | null = (req as any).user?.id ?? null;
    if (createdById) {
      const u = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
      if (!u) createdById = null;
    }

    const effectivePunches: Punch[] =
      Array.isArray(segments) && segments.length === 2
        ? ([] as Punch[]).concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
        : (punches as Punch[]);

    const punchKey = buildPunchKey(
      effectivePunches as any,
      computedBreaks.map((b) => ({
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
      }))
    );

    const workDateDb = new Date(`${ws}T00:00:00`);

    const existing = await prisma.timeEntry.findFirst({
      where: {
        employeeId: String(employeeId),
        facilityId: String(facilityId),
        workDate: workDateDb,
        shiftType: shiftTypeForDb as any,
        punchKey,
      },
      select: { id: true, status: true },
    });

    if (existing) {
      return res.status(409).json({
        error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${existing.id}, status ${existing.status}).`,
      });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: String(employeeId),
        workDate: new Date(`${ws}T00:00:00`),
        facilityId: String(facilityId),
        shiftType: shiftTypeForDb as any,
        punchKey,
        minutesWorked: workedMinutes,
        breakMinutes,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        punchesJson: effectivePunches as any,
        breaksJson: (breaks ?? []) as any,
        notes: notes ?? null,
        status: TIME_ENTRY_STATUS.DRAFT as any,
        createdById,
      } as any,
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        facilityId: true,
        shiftType: true,
        punchKey: true,
        minutesWorked: true,
        breakMinutes: true,
        startTime: true,
        endTime: true,
        punchesJson: true,
        breaksJson: true,
        notes: true,
        status: true,
        facility: { select: { id: true, name: true } },
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
        createdById: true,
        createdAt: true,
      } as any,
    });

    if (computedBreaks.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computedBreaks.map((b) => ({
          timeEntryId: String((entry as any).id),
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: Number(b.minutes),
        })),
      });
    }

    const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
    const buckets = splitDailyBuckets(payableMinutes);

    return res.json({
      entry,
      breaksStored: computedBreaks.length,
      preview: {
        workedMinutes,
        breakMinutes,
        payableMinutes,
        calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
        buckets: {
          regularMinutes: buckets.regularMinutes,
          overtimeMinutes: buckets.overtimeMinutes,
          doubleMinutes: buckets.doubleMinutes,
          regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
          overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
          double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
        },
      },
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry failed:", e);

    if (e?.code === "P2002") {
      return res.status(409).json({
        error: "Duplicate entry: this employee already has the same day/facility/shift with identical punches.",
      });
    }

    return res.status(400).json({
      error: e?.message || "Failed to create time entry",
    });
  }
});

router.patch("/time-entry/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const editable = await assertEditableNotLocked(id, req);
    if (!editable.ok) return res.status(editable.http).json({ error: editable.msg });

    const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};

    if (!facilityId) return res.status(400).json({ error: "facilityId required" });
    if (!employeeId || !workDate || !shiftType) {
      return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
    }
    if (!Object.values(SHIFT_TYPE).includes(shiftType)) {
      return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
    }

        const hasSecondPunch =
      Array.isArray(punches) &&
      punches.length >= 2 &&
      String(punches[1]?.clockIn || "").trim() &&
      String(punches[1]?.clockOut || "").trim();

    const isCombinedShiftType =
      shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM";

    if (hasSecondPunch && !isCombinedShiftType) {
      return res.status(400).json({
        error:
          "Two-shift punches were entered, but Shift Type is not combined. Please use AM+PM, PM+NOC, or NOC+AM.",
      });
    }

    if (!hasSecondPunch && isCombinedShiftType) {
      return res.status(400).json({
        error:
          "Combined Shift Type selected, but second-shift punches are missing.",
      });
    }

    await assertFacilityRateExists({
      employeeId: String(employeeId),
      facilityId: String(facilityId),
      workDate: String(workDate),
    });

    const emp = await prisma.employee.findUnique({
      where: { id: String(employeeId) },
    });
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const ws = String(workDate);

    let workedMinutes = 0;
    let startTime: Date | null = null;
    let endTime: Date | null = null;
    let shiftTypeForDb: any = "AM";

    if (Array.isArray(segments) && segments.length === 2) {
      const s1 = segments[0] as Segment;
      const s2 = segments[1] as Segment;

      if (!s1?.shift || !s2?.shift) {
        return res.status(400).json({ error: "segments[].shift required" });
      }
      if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
        return res.status(400).json({ error: "segments[].punches required" });
      }

      const combined = `${s1.shift}+${s2.shift}`;
      if (combined !== shiftType) {
        return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
      }

      const a = computeWorkedMinutes(ws, s1.punches);
      const b = computeWorkedMinutes(ws, s2.punches);

      validateTwoSegmentContinuity(
        { shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut },
        { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut }
      );

      workedMinutes = a.workedMinutes + b.workedMinutes;
      startTime = a.firstIn;
      endTime = b.lastOut;
      shiftTypeForDb = mapShiftTypeToDb(shiftType) as any;
    } else {
      if (!Array.isArray(punches) || punches.length === 0) {
        return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
      }

      const r = computeWorkedMinutes(ws, punches as Punch[]);
      workedMinutes = r.workedMinutes;
      startTime = r.firstIn;
      endTime = r.lastOut;
      shiftTypeForDb = mapShiftTypeToDb(shiftType) as any;
    }

    const computedBreaks = computeBreakRows(ws, Array.isArray(breaks) ? (breaks as BreakInput[]) : []);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);

    if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
      return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
    }

    const effectivePunches: Punch[] =
      Array.isArray(segments) && segments.length === 2
        ? ([] as Punch[]).concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
        : (punches as Punch[]);

    const punchKey = buildPunchKey(
      effectivePunches as any,
      computedBreaks.map((b) => ({
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
      }))
    );

    const workDateDb = new Date(`${ws}T00:00:00`);

    const dup = await prisma.timeEntry.findFirst({
      where: {
        id: { not: id },
        employeeId: String(employeeId),
        facilityId: String(facilityId),
        workDate: workDateDb,
        shiftType: shiftTypeForDb as any,
        punchKey,
      },
      select: { id: true, status: true },
    });

    if (dup) {
      return res.status(409).json({
        error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${dup.id}, status ${dup.status}).`,
      });
    }

    const normalizedBreakInputs =
  Array.isArray(breaks)
    ? (breaks as BreakInput[])
        .filter((b) => String(b?.startTime || "").trim() && String(b?.endTime || "").trim())
        .map((b) => ({
          startTime: String(b.startTime || "").trim(),
          endTime: String(b.endTime || "").trim(),
        }))
    : [];

const data: any = {
  employeeId: String(employeeId),
  facilityId: String(facilityId),
  workDate: workDateDb,
  shiftType: shiftTypeForDb as any,
  punchKey,
  minutesWorked: workedMinutes,
  breakMinutes,
  startTime,
  endTime,
  notes: notes ?? null,
  punchesJson: effectivePunches as any,
  breaksJson: normalizedBreakInputs as any,
};    

    if (req.body.status) {
      data.status = String(req.body.status);
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data,
      select: {
        id: true,
        employeeId: true,
        facilityId: true,
        workDate: true,
        shiftType: true,
        status: true,
        minutesWorked: true,
        breakMinutes: true,
        startTime: true,
        endTime: true,
        notes: true,
        punchKey: true,
        punchesJson: true,
        breaksJson: true,
        facility: { select: { id: true, name: true } },
        employee: { select: { id: true, legalName: true, preferredName: true, email: true } },
      } as any,
    });

    await prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });
    if (computedBreaks.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computedBreaks.map((b) => ({
          timeEntryId: id,
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: b.minutes,
        })),
      });
    }

    return res.json({ entry: updated,
       shiftType: mapShiftTypeFromDb(String(updated.shiftType || "")),
  
       breaksStored: computedBreaks.length });
  } catch (e: any) {
    console.error("PATCH /api/admin/time-entry/:id failed:", e);
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "Duplicate entry constraint hit." });
    }
    return res.status(e?.status || 400).json({ error: e?.message || "Failed to update time entry" });
  }
});

router.post("/time-entry/:id/pay-now", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const paidNote = String(req.body?.paidNote || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const createdById =
      (req as any)?.user?.sub
        ? String((req as any).user.sub)
        : ((req as any)?.user?.id ? String((req as any).user.id) : null);

    const entry = await prisma.timeEntry.findUnique({
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
        breaks: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            minutes: true,
          },
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: "Time entry not found" });
    }

    if (!entry.employeeId) {
      return res.status(400).json({ error: "Time entry is missing employee" });
    }

    if (!entry.facilityId) {
      return res.status(400).json({ error: "Time entry is missing facility" });
    }

const marker = `TIME_ENTRY_PAY_NOW:${id}`;

const existingLedgerMarker = await prisma.employeePayrollLedger.findFirst({
  where: {
    employeeId: entry.employeeId,
    note: { contains: marker },
  },
  select: { id: true },
});

if (existingLedgerMarker) {
  return res.status(409).json({
    error: "This time entry has already been paid with Pay Now.",
  });
}
    const computedBreakMinutes = sumBreakMinutesFromEntry(entry);
    const workedMinutes = Number(entry.minutesWorked || 0);
    const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);

    if (payableMinutes <= 0) {
      return res.status(400).json({
        error: "This time entry has no payable time.",
      });
    }

    const buckets = splitDailyBuckets(payableMinutes);
    const rateCents = Number(entry.employee?.hourlyRateCents || 0);

    if (!Number.isFinite(rateCents) || rateCents <= 0) {
      return res.status(400).json({
        error: "Employee hourly rate is missing or invalid.",
      });
    }

const holidayRule = await getHolidayRule(entry.workDate);

const payCalc = calculatePayCentsWithRule({
  regularMinutes: buckets.regularMinutes,
  overtimeMinutes: buckets.overtimeMinutes,
  doubleMinutes: buckets.doubleMinutes,
  hourlyRateCents: rateCents,
  holidayRule,
});

const regularPayCents = payCalc.regularPayCents;
const overtimePayCents = payCalc.overtimePayCents;
const doublePayCents = payCalc.doublePayCents;
const amountCents = payCalc.grossPayCents;

    if (amountCents <= 0) {
      return res.status(400).json({
        error: "Calculated pay amount is zero.",
      });
    }

    console.log("TIME_ENTRY_PAY_NOW_ATTEMPT", {
  entryId: id,
  employeeId: entry.employeeId,
  amountCents,
  marker,
});
    const { periodStart, periodEnd } = getPayrollWeekBounds(entry.workDate);

    const finalizedRun = await prisma.payrollRun.findFirst({
      where: {
        periodStart,
        periodEnd,
        status: "FINALIZED",
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    const facilityRate = await findFacilityRateForEntry(entry);

const billAmountCents = facilityRate
  ? calculateBillCentsWithRule({
      regularMinutes: buckets.regularMinutes,
      overtimeMinutes: buckets.overtimeMinutes,
      doubleMinutes: buckets.doubleMinutes,
      regRateCents: Number(facilityRate.regRateCents || 0),
      otRateCents: Number(facilityRate.otRateCents || 0),
      dtRateCents: Number(facilityRate.dtRateCents || 0),
      holidayRule,
    })
  : 0;

    const result = await prisma.$transaction(async (tx) => {
      if (entry.status === "DRAFT") {
        await tx.timeEntry.update({
          where: { id },
          data: { status: "APPROVED" },
        });
      }

      if (finalizedRun) {
        const adjustment = await tx.payrollAdjustment.create({
          data: {
            employeeId: entry.employeeId,
            facilityId: entry.facilityId,
            workDate: entry.workDate,
            shiftType: entry.shiftType as any,
            punchesJson: (entry as any).punchesJson ?? null,
            breaksJson: (entry as any).breaksJson ?? null,
            reason: `Pay Now from time entry (${marker})`,
            amountCents,
            payableMinutes,
            regularMinutes: buckets.regularMinutes,
            overtimeMinutes: buckets.overtimeMinutes,
            doubleMinutes: buckets.doubleMinutes,
            billAmountCents,
            payrollRunId: null,
            paidImmediately: true,
            paidAt: new Date(),
            paidNote: paidNote
    ? `${paidNote} | ${marker}`
    : marker,
	    paidAmountCents: amountCents,
            billedAt: null,
            invoiceNumber: null,
            invoiceType: null,
          },
        });

        await tx.employeePayrollLedger.create({
          data: {
            employeeId: entry.employeeId,
            periodStart,
            periodEnd,
            type: "EARNINGS_ADJUSTMENT",
            amountCents,
            note: `Time entry pay now earnings (${marker})`,
            createdById,
          },
        });

        await tx.employeePayrollLedger.create({
          data: {
            employeeId: entry.employeeId,
            periodStart,
            periodEnd,
            type: "EARLY_PAY",
            amountCents: -amountCents,
            note: `Time entry pay now payment (${marker})`,
            createdById,
          },
        });

        return {
          mode: "POST_FINALIZE_ADJUSTMENT",
          adjustmentId: adjustment.id,
        };
      }
   const existingEarly = await tx.earlyPayrollPayment.findFirst({
  where: {
    employeeId: entry.employeeId,
    periodStart,
    periodEnd,
  },
  select: {
    id: true,
    amountCents: true,
    note: true,
    payrollRunId: true,
  },
});

if (existingEarly?.payrollRunId) {
  throw new Error("This payroll week is already attached to a payroll run.");
}

if (existingEarly) {
  await tx.earlyPayrollPayment.update({
    where: { id: existingEarly.id },
    data: {
      amountCents: Number(existingEarly.amountCents || 0) + amountCents,
      note: [existingEarly.note, marker].filter(Boolean).join(" | "),
      createdById,
    },
  });
} else {
  await tx.earlyPayrollPayment.create({
    data: {
      employeeId: entry.employeeId,
      periodStart,
      periodEnd,
      amountCents,
      note: marker,
      createdById,
    },
  });
}
const debugEarly = await tx.earlyPayrollPayment.findMany({
  where: {
    employeeId: entry.employeeId,
    periodStart,
    periodEnd,
  },
  select: {
    id: true,
    employeeId: true,
    periodStart: true,
    periodEnd: true,
    amountCents: true,
    note: true,
    payrollRunId: true,
  },
});

console.log("DEBUG_EARLY_PAYMENTS_AFTER_PAY_NOW", {
  entryId: id,
  employeeId: entry.employeeId,
  workDate: entry.workDate,
  periodStart,
  periodEnd,
  amountCents,
  rows: debugEarly,
});
await tx.employeePayrollLedger.create({
  data: {
    employeeId: entry.employeeId,
    periodStart,
    periodEnd,
    type: "EARLY_PAY",
    amountCents: -amountCents,
    note: `Time entry pay now early payment (${marker})`,
    createdById,
  },
});

return {
  mode: "PRE_FINALIZE_EARLY_PAY",
};
});

    return res.json({
      ok: true,
      entryId: id,
      employeeId: entry.employeeId,
      workDate: entry.workDate,
      amountCents,
      amount: centsToMoney(amountCents),
      mode: result.mode,
      finalizedWeek: !!finalizedRun,
      payableMinutes,
      regularMinutes: buckets.regularMinutes,
      overtimeMinutes: buckets.overtimeMinutes,
      doubleMinutes: buckets.doubleMinutes,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/:id/pay-now failed:", e);
    return res.status(500).json({
      error: e?.message || "Failed to pay time entry now",
    });
  }
});


router.post("/time-entry/:id/breaks", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const editable = await assertEditableNotLocked(id, req);
    if (!editable.ok) return res.status(editable.http).json({ error: editable.msg });

    const { workDate, breaks } = req.body || {};
    if (!workDate) return res.status(400).json({ error: "workDate required" });

    const ws = String(workDate);
    const computed = computeBreakRows(ws, Array.isArray(breaks) ? breaks : []);

    await prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });

    if (computed.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computed.map((b) => ({
          timeEntryId: id,
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: b.minutes,
        })),
      });
    }

    const breakMinutes = computed.reduce((sum, b) => sum + b.minutes, 0);
    await prisma.timeEntry.update({
      where: { id },
      data: { breakMinutes },
    });

    return res.json({ ok: true, breakMinutes, breaksStored: computed.length });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/:id/breaks failed:", e);
    return res.status(e?.status || 400).json({ error: e?.message || "Failed to update breaks" });
  }
});

router.post("/time-entry/approve-week", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const startDate = String(req.body.startDate || "").trim();
    const endDate = String(req.body.endDate || "").trim();

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(startDate);
    const toExclusive = startOfNextDayUTC(endDate);

    const result = await prisma.timeEntry.updateMany({
      where: {
        employeeId,
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: "DRAFT",
      },
      data: {
        status: "APPROVED",
      },
    });

    return res.json({
      ok: true,
      employeeId,
      startDate,
      endDate,
      approvedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/approve-week failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve week" });
  }
});

router.post("/time-entry/lock-week", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const startDate = String(req.body.startDate || "").trim();
    const endDate = String(req.body.endDate || "").trim();

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(startDate);
    const toExclusive = startOfNextDayUTC(endDate);

    const result = await prisma.timeEntry.updateMany({
      where: {
        employeeId,
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: {
          in: ["DRAFT", "APPROVED"],
        },
      },
      data: {
        status: "LOCKED",
      },
    });

    return res.json({
      ok: true,
      employeeId,
      startDate,
      endDate,
      lockedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/lock-week failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to lock week" });
  }
});

router.post("/time-entries/approve", async (req, res) => {
  try {
    const { from, to } = req.body || {};
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const fromDt = startOfDayUTC(String(from));
    const toExclusive = startOfNextDayUTC(String(to));

    const r = await prisma.timeEntry.updateMany({
      where: {
        status: "DRAFT",
        workDate: { gte: fromDt, lt: toExclusive },
      },
      data: { status: "APPROVED" },
    });

    return res.json({ approvedCount: r.count });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/approve failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve entries" });
  }
});

router.post("/time-entries/approve-selected", async (req, res) => {
  try {
    const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];

    if (entryIds.length === 0) {
      return res.status(400).json({ error: "entryIds required" });
    }

    const result = await prisma.timeEntry.updateMany({
      where: {
        id: { in: entryIds },
        status: "DRAFT",
      },
      data: {
        status: "APPROVED",
      },
    });

    return res.json({
      ok: true,
      approvedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/approve-selected failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve selected entries" });
  }
});

router.post("/time-entries/lock-selected", async (req, res) => {
  try {
    const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];

    if (entryIds.length === 0) {
      return res.status(400).json({ error: "entryIds required" });
    }

    const result = await prisma.timeEntry.updateMany({
      where: {
        id: { in: entryIds },
        status: { in: ["DRAFT", "APPROVED"] },
      },
      data: {
        status: "LOCKED",
      },
    });

    return res.json({
      ok: true,
      lockedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/lock-selected failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to lock selected entries" });
  }
});

export default router;
