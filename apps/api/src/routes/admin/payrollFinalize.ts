import express from "express";
import { prisma } from "../../prisma";

const router = express.Router();

function startOfDayUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function startOfNextDayUTC(iso: string) {
  const d = startOfDayUTC(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function fmtISODateOnly(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function splitDailyBuckets(payableMinutes: number) {
  const m = Math.max(0, Math.floor(payableMinutes));
  const regularCap = 8 * 60;
  const otCap = 12 * 60;

  const regularMinutes = Math.min(m, regularCap);
  const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
  const doubleMinutes = Math.max(0, m - otCap);

  return { regularMinutes, overtimeMinutes, doubleMinutes };
}

function findEffectiveFacilityRate(
  rates: Array<{
    facilityId?: string | null;
    title: string;
    effectiveFrom: Date;
    regRateCents: number;
    otRateCents: number;
    dtRateCents: number;
  }>,
  title: string,
  workDate: Date
) {
  const matches = rates.filter(
    (r) =>
      String(r.title) === String(title) &&
      new Date(r.effectiveFrom).getTime() <= new Date(workDate).getTime()
  );

  if (matches.length === 0) return null;

  matches.sort(
    (a, b) =>
      new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );

  return matches[0];
}

// POST /api/admin/payroll-runs/finalize
router.post("/payroll-runs/finalize", async (req, res) => {
  try {
    const periodStart = String(req.body.periodStart || "").trim();
    const periodEnd = String(req.body.periodEnd || "").trim();
    const notes = req.body.notes == null ? null : String(req.body.notes);

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(periodStart);
    const toExclusive = startOfNextDayUTC(periodEnd);

    const existing = await prisma.payrollRun.findFirst({
      where: {
        periodStart: fromDt,
        periodEnd: startOfDayUTC(periodEnd),
        status: "FINALIZED",
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: "A finalized payroll run already exists for this pay period" });
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: {
          in: ["APPROVED", "LOCKED"],
        },
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
        breaks: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            minutes: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
    });

    if (entries.length === 0) {
      return res.status(400).json({ error: "No approved/locked time entries found for this pay period" });
    }

    const facilityIds = Array.from(
      new Set(entries.map((e) => String(e.facilityId || "")).filter(Boolean))
    );

    const facilityRates = await prisma.facilityRate.findMany({
      where: {
        facilityId: { in: facilityIds },
      },
      orderBy: [
        { facilityId: "asc" },
        { title: "asc" },
        { effectiveFrom: "desc" },
      ],
    });

    const validationErrors: string[] = [];

    for (const e of entries) {
      const employeeName =
        e.employee?.preferredName
          ? `${e.employee.legalName} (${e.employee.preferredName})`
          : e.employee?.legalName || e.employeeId;

      const title = String((e.employee as any)?.title || "").trim();
      if (!title) {
        validationErrors.push(`Employee "${employeeName}" has no designation/title.`);
        continue;
      }

      const facId = String(e.facilityId || "").trim();
      if (!facId) {
        validationErrors.push(
          `Employee "${employeeName}" has a time entry on ${fmtISODateOnly(e.workDate)} with no facility.`
        );
        continue;
      }

      const facilityName = e.facility?.name || facId;

      const applicableRates = facilityRates.filter(
        (r) => String(r.facilityId || "") === facId
      );

      const effectiveRate = findEffectiveFacilityRate(
        applicableRates as any[],
        title,
        new Date(e.workDate)
      );

      if (!effectiveRate) {
        validationErrors.push(
          `Missing billing rate for facility "${facilityName}", title "${title}", work date ${fmtISODateOnly(e.workDate)}.`
        );
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Payroll cannot be finalized until all facility billing setup is complete.",
        details: validationErrors,
      });
    }

   const earlyPayments = await prisma.earlyPayrollPayment.findMany({
  where: {
    periodStart: fromDt,
    periodEnd: startOfDayUTC(periodEnd),
  },
  select: {
    id: true,
    employeeId: true,
    amountCents: true,
  },
});

const earlyPaymentByEmployee = new Map<
  string,
  {
    id: string;
    employeeId: string;
    amountCents: number;
    paidAt: Date;
    note: string | null;
    payrollRunId: string | null;
  }
>();
for (const p of earlyPayments) {
  earlyPaymentByEmployee.set(String(p.employeeId), p);
}



const createdById = (req as any).user?.id || null;   

    const result = await prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          periodStart: fromDt,
          periodEnd: startOfDayUTC(periodEnd),
          status: "FINALIZED",
          notes,
          createdById,
          finalizedAt: new Date(),
        },
      });

      const byEmployee = new Map<
        string,
        {
          employeeId: string;
          regularMinutes: number;
          overtimeMinutes: number;
          doubleMinutes: number;
          breakMinutes: number;
          payableMinutes: number;
          regularPayCents: number;
          overtimePayCents: number;
          doublePayCents: number;
          grossPayCents: number;
        }
      >();

      for (const e of entries) {
        const breaks = Array.isArray(e.breaks) ? e.breaks : [];
        const computedBreakMinutes =
          breaks.length > 0
            ? breaks.reduce((sum, b) => sum + Number(b.minutes || 0), 0)
            : Number((e as any).breakMinutes || 0);

        const workedMinutes = Number(e.minutesWorked || 0);
        const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);

        const buckets = splitDailyBuckets(payableMinutes);
        const rateCents = Number(e.employee?.hourlyRateCents || 0);

        const regularPayCents = Math.round((buckets.regularMinutes * rateCents) / 60);
        const overtimePayCents = Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60);
        const doublePayCents = Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
        const grossPayCents = regularPayCents + overtimePayCents + doublePayCents;

        const current =
          byEmployee.get(e.employeeId) || {
            employeeId: e.employeeId,
            regularMinutes: 0,
            overtimeMinutes: 0,
            doubleMinutes: 0,
            breakMinutes: 0,
            payableMinutes: 0,
            regularPayCents: 0,
            overtimePayCents: 0,
            doublePayCents: 0,
            grossPayCents: 0,
          };

        current.regularMinutes += buckets.regularMinutes;
        current.overtimeMinutes += buckets.overtimeMinutes;
        current.doubleMinutes += buckets.doubleMinutes;
        current.breakMinutes += computedBreakMinutes;
        current.payableMinutes += payableMinutes;
        current.regularPayCents += regularPayCents;
        current.overtimePayCents += overtimePayCents;
        current.doublePayCents += doublePayCents;
        current.grossPayCents += grossPayCents;

        byEmployee.set(e.employeeId, current);

        await tx.payrollRunEntrySnapshot.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: e.employeeId,
            timeEntryId: e.id,
            workDate: e.workDate,
            status: String(e.status),
            snapshotJson: {
              timeEntryId: e.id,
              employeeId: e.employeeId,
              employeeName: e.employee?.legalName ?? null,
              facilityId: e.facilityId,
              facilityName: e.facility?.name ?? null,
              workDate: e.workDate,
              shiftType: e.shiftType,
              status: e.status,
              punchesJson: (e as any).punchesJson ?? null,
              breaksJson: (e as any).breaksJson ?? null,
              breakRows: breaks,
              workedMinutes,
              breakMinutes: computedBreakMinutes,
              payableMinutes,
              regularMinutes: buckets.regularMinutes,
              overtimeMinutes: buckets.overtimeMinutes,
              doubleMinutes: buckets.doubleMinutes,
              hourlyRateCents: rateCents,
              regularPayCents,
              overtimePayCents,
              doublePayCents,
              grossPayCents,
              notes: e.notes ?? null,
            } as any,
          },
        });
      }

      for (const [, totals] of byEmployee) {
        const adjustments = await tx.payrollAdjustment.findMany({
          where: {
            employeeId: totals.employeeId,
            payrollRunId: null,
          },
          select: { id: true, amountCents: true },
        });

        const loanDeductions = await tx.loanDeduction.findMany({
          where: {
            employeeId: totals.employeeId,
            periodStart: { gte: fromDt },
            periodEnd: { lt: toExclusive },
          },
          select: { amountCents: true },
        });

const adjustmentsCents = adjustments.reduce(
  (sum: number, adj: { amountCents: number }) => sum + Number(adj.amountCents || 0),
  0
);

const loanDeductionCents = loanDeductions.reduce(
  (sum: number, d: { amountCents: number }) => sum + Number(d.amountCents || 0),
  0
);

const earlyPayment = earlyPaymentByEmployee.get(String(totals.employeeId)) as
    | {
        id: string;
        employeeId: string;
        amountCents: number;
        paidAt: Date;
        note: string | null;
        payrollRunId: string | null;
      }
    | null;

const paidEarly = !!earlyPayment;
const paidEarlyAmountCents = Number(earlyPayment?.amountCents || 0);

// Full net for the pay period
const totalNetForPeriodCents =
  totals.grossPayCents + adjustmentsCents - loanDeductionCents;

// What still needs to be paid now in this finalized run
const netPayCents = paidEarly
  ? Math.max(0, totalNetForPeriodCents - paidEarlyAmountCents)
  : totalNetForPeriodCents;

await tx.payrollRunEmployee.create({
  data: {
    payrollRunId: payrollRun.id,
    employeeId: totals.employeeId,
    regularMinutes: totals.regularMinutes,
    overtimeMinutes: totals.overtimeMinutes,
    doubleMinutes: totals.doubleMinutes,
    breakMinutes: totals.breakMinutes,
    payableMinutes: totals.payableMinutes,
    regularPayCents: totals.regularPayCents,
    overtimePayCents: totals.overtimePayCents,
    doublePayCents: totals.doublePayCents,
    grossPayCents: totals.grossPayCents,
    adjustmentsCents,
    loanDeductionCents,
    netPayCents,
    paidEarly,
    paidEarlyAmountCents,
    snapshotVersion: 1,
  },
});

        if (adjustments.length > 0) {
          await tx.payrollAdjustment.updateMany({
            where: {
              id: { in: adjustments.map((a) => a.id) },
            },
            data: {
              payrollRunId: payrollRun.id,
            },
          });
        }
       if (earlyPayments.length > 0) {
  await tx.earlyPayrollPayment.updateMany({
    where: {
      id: { in: earlyPayments.map((p) => p.id) },
    },
    data: {
      payrollRunId: payrollRun.id,
    },
  });
}
      }

      return {
        payrollRunId: payrollRun.id,
        employeeCount: byEmployee.size,
        snapshotCount: entries.length,
      };
    });

    return res.json({
      ok: true,
      periodStart,
      periodEnd,
      payrollRunId: result.payrollRunId,
      employeeCount: result.employeeCount,
      snapshotCount: result.snapshotCount,
    });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-runs/finalize failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to finalize payroll run" });
  }
});

export default router;
