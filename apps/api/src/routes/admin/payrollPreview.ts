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

function sumBreakMinutesFromEntry(e: any): number {
  const breaks: Array<{ minutes: number | null }> = Array.isArray(e.breaks) ? e.breaks : [];
  if (breaks.length > 0) {
    return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
  }
  return Number(e.breakMinutes ?? 0);
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

router.get("/payroll-runs/preview", async (req, res) => {
  try {
    const periodStart = String(req.query.periodStart || "").trim();
    const periodEnd = String(req.query.periodEnd || "").trim();

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd required" });
    }

    const fromDt = startOfDayUTC(periodStart);
    const toExclusive = startOfNextDayUTC(periodEnd);

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
            active: true,
          },
        },
        breaks: {
          select: {
            minutes: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
    });

    const earlyPayments = await prisma.earlyPayrollPayment.findMany({
      where: {
        periodStart: fromDt,
        periodEnd: startOfDayUTC(periodEnd),
      },
      select: {
        id: true,
        employeeId: true,
        amountCents: true,
        paidAt: true,
        note: true,
      },
    });

    const earlyByEmployee = new Map(
      earlyPayments.map((p) => [String(p.employeeId), p])
    );

    const byEmployee = new Map<string, any>();

    for (const e of entries) {
      const employeeId = String(e.employeeId);
      const workedMinutes = Number(e.minutesWorked || 0);
      const breakMinutes = sumBreakMinutesFromEntry(e);
      const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
      const buckets = splitDailyBuckets(payableMinutes);
      const rateCents = Number(e.employee?.hourlyRateCents || 0);

      const regularPayCents = Math.round((buckets.regularMinutes * rateCents) / 60);
      const overtimePayCents = Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60);
      const doublePayCents = Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
      const grossPayCents = regularPayCents + overtimePayCents + doublePayCents;

      const current =
        byEmployee.get(employeeId) || {
          employeeId,
          employee: e.employee,
          entryCount: 0,
          workedMinutes: 0,
          breakMinutes: 0,
          payableMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          doubleMinutes: 0,
          grossPayCents: 0,
        };

      current.entryCount += 1;
      current.workedMinutes += workedMinutes;
      current.breakMinutes += breakMinutes;
      current.payableMinutes += payableMinutes;
      current.regularMinutes += buckets.regularMinutes;
      current.overtimeMinutes += buckets.overtimeMinutes;
      current.doubleMinutes += buckets.doubleMinutes;
      current.grossPayCents += grossPayCents;

      byEmployee.set(employeeId, current);
    }

    const employees = Array.from(byEmployee.values()).map((row) => {
      const earlyPayment = earlyByEmployee.get(String(row.employeeId)) || null;
      return {
        ...row,
        payStatus: earlyPayment ? "PAID_EARLY" : "READY",
        earlyPayment,
      };
    });

    const totals = employees.reduce(
      (acc, row) => {
        acc.employeeCount += 1;
        acc.grossPayCents += Number(row.grossPayCents || 0);

        if (row.earlyPayment) {
          acc.paidEarlyCount += 1;
          acc.paidEarlyCents += Number(row.earlyPayment.amountCents || 0);
        } else {
          acc.remainingCount += 1;
          acc.remainingGrossPayCents += Number(row.grossPayCents || 0);
        }

        return acc;
      },
      {
        employeeCount: 0,
        grossPayCents: 0,
        paidEarlyCount: 0,
        paidEarlyCents: 0,
        remainingCount: 0,
        remainingGrossPayCents: 0,
      }
    );

    return res.json({
      periodStart,
      periodEnd,
      employees,
      totals,
    });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs/preview failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to preview payroll run" });
  }
});

export default router;
