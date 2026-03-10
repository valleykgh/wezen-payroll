import express from "express";
import { prisma } from "../../prisma";
import {
  calculateTimeEntryTotals,
  findEffectiveFacilityRate,
  fmtHHMM,
  fmtISODateOnly,
  splitDailyBuckets,
  startOfDayUTC,
  startOfNextDayUTC,
  sumBreakMinutesFromEntry,
} from "./_shared";

const router = express.Router();

router.get("/pay-summary", async (req, res) => {
  try {
    const { employeeId, from, to, status } = req.query as {
      employeeId?: string;
      from?: string;
      to?: string;
      status?: string;
    };

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }

    const where: any = {};
    if (employeeId) where.employeeId = String(employeeId);
    const statusParam = (status ? String(status) : "").trim();

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    } else if (!statusParam) {
      where.status = { in: ["APPROVED", "LOCKED"] };
    }

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDayUTC(from);
      if (to) where.workDate.lt = startOfNextDayUTC(to);
    }

    const fromDate = from ? startOfDayUTC(from) : null;
    const toExclusive = to ? startOfNextDayUTC(to) : null;

    const entries = await prisma.timeEntry.findMany({
      where,
      select: {
        id: true,
        workDate: true,
        minutesWorked: true,
        breakMinutes: true,
        breaks: { select: { minutes: true } },
        employee: { select: { hourlyRateCents: true } },
      },
      orderBy: { workDate: "asc" },
    });

    const rate = entries[0]?.employee?.hourlyRateCents ?? 0;

    const totalWorkedMinutes = entries.reduce(
      (sum, e: any) => sum + Number(e.minutesWorked ?? 0),
      0
    );

    const totalBreakMinutes = entries.reduce(
      (sum, e: any) => sum + sumBreakMinutesFromEntry(e),
      0
    );

    const payableMinutes = entries.reduce((sum, e: any) => {
      const worked = Number(e.minutesWorked ?? 0);
      const br = sumBreakMinutesFromEntry(e);
      return sum + Math.max(0, worked - br);
    }, 0);

    const grossPayCents = Math.round((payableMinutes * rate) / 60);

    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: String(employeeId),
        payrollRunId: null,
      },
      select: { amountCents: true },
    });

    const adjustmentsCents = adjustments.reduce(
      (sum, a: any) => sum + Number(a.amountCents ?? 0),
      0
    );

    const loanWhere: any = { employeeId: String(employeeId) };
    if (fromDate) loanWhere.periodStart = { gte: fromDate };
    if (toExclusive) loanWhere.periodEnd = { lt: toExclusive };

    const loanDeductions = await prisma.loanDeduction.findMany({
      where: loanWhere,
      select: {
        amountCents: true,
      },
    });

    const loanDeductionCents = loanDeductions.reduce(
      (sum, d) => sum + Number(d.amountCents ?? 0),
      0
    );

    const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;

    return res.json({
      employeeId: String(employeeId),
      totals: {
        totalWorkedMinutes,
        totalBreakMinutes,
        payableMinutes,
        payableHours: Math.round((payableMinutes / 60) * 100) / 100,
        hourlyRateCents: rate,
        grossPayCents,
        adjustmentsCents,
        netPayCents,
        loanDeductionCents,
      },
      adjustments,
      loanDeductions,
      debug: { entryCount: entries.length },
    });
  } catch (e) {
    console.error("GET /api/admin/pay-summary failed:", e);
    return res.status(500).json({ error: "Failed to compute admin pay summary" });
  }
});

router.get("/payroll-adjustments", async (req, res) => {
  try {
    const adjustments = await prisma.payrollAdjustment.findMany({
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
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
  } catch (e: any) {
    console.error("GET /api/admin/payroll-adjustments failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll adjustments" });
  }
});

router.post("/payroll-adjustments", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const reason = String(req.body.reason || "").trim();
    const amountCents = Number(req.body.amountCents);

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!reason) {
      return res.status(400).json({ error: "reason required" });
    }
    if (!Number.isFinite(amountCents) || amountCents === 0) {
      return res.status(400).json({ error: "amountCents must be a non-zero number" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId,
        reason,
        amountCents,
        payrollRunId: null,
      },
    });

    return res.json({ ok: true, adjustment });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-adjustments failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to create payroll adjustment" });
  }
});

router.get("/payroll-runs", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.periodStart = {};
      if (from) where.periodStart.gte = startOfDayUTC(from);
      if (to) where.periodStart.lt = startOfNextDayUTC(to);
    }

    const runs = await prisma.payrollRun.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        employees: {
          select: {
            id: true,
            employeeId: true,
            grossPayCents: true,
            adjustmentsCents: true,
            loanDeductionCents: true,
            netPayCents: true,
          },
        },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    });

    const items = runs.map((run) => {
      const employeeCount = run.employees.length;

      const grossPayCents = run.employees.reduce(
        (sum, e) => sum + Number(e.grossPayCents || 0),
        0
      );
      const adjustmentsCents = run.employees.reduce(
        (sum, e) => sum + Number(e.adjustmentsCents || 0),
        0
      );
      const loanDeductionCents = run.employees.reduce(
        (sum, e) => sum + Number(e.loanDeductionCents || 0),
        0
      );
      const netPayCents = run.employees.reduce(
        (sum, e) => sum + Number(e.netPayCents || 0),
        0
      );

      return {
        id: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        notes: run.notes,
        finalizedAt: run.finalizedAt,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
        employeeCount,
        grossPayCents,
        adjustmentsCents,
        loanDeductionCents,
        netPayCents,
      };
    });

    return res.json({ payrollRuns: items });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to list payroll runs" });
  }
});

router.get("/payroll-runs/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        employees: {
          include: {
            employee: {
              select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                payrollAdjustments: {
                  orderBy: { createdAt: "desc" },
                  select: {
                    id: true,
                    amountCents: true,
                    reason: true,
                    createdAt: true,
                    payrollRunId: true,
                  },
                },
              },
            },
          },
          orderBy: {
            employeeId: "asc",
          },
        },
        entrySnapshots: {
          include: {
            employee: {
              select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
              },
            },
            corrections: {
              select: {
                id: true,
                reason: true,
                adjustmentAmountCents: true,
                createdAt: true,
                createdById: true,
                payrollAdjustmentId: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            workDate: "asc",
          },
        },
      },
    });

    if (!payrollRun) {
      return res.status(404).json({ error: "Payroll run not found" });
    }

    return res.json({ payrollRun });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs/:id failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll run" });
  }
});

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

        const adjustmentsCents = adjustments.reduce((s, a) => s + Number(a.amountCents || 0), 0);
        const loanDeductionCents = loanDeductions.reduce((s, d) => s + Number(d.amountCents || 0), 0);
        const netPayCents = totals.grossPayCents + adjustmentsCents - loanDeductionCents;

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

router.get("/payroll-runs/:runId/snapshots/:snapshotId", async (req, res) => {
  try {
    const runId = String(req.params.runId || "");
    const snapshotId = String(req.params.snapshotId || "");

    const snapshot = await prisma.payrollRunEntrySnapshot.findFirst({
      where: {
        id: snapshotId,
        payrollRunId: runId,
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
        payrollRun: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    return res.json({ snapshot });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs/:runId/snapshots/:snapshotId failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll snapshot" });
  }
});

router.get("/payroll-correction/calc", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "").trim();
    const workDate = String(req.query.workDate || "").trim();
    const shiftType = String(req.query.shiftType || "AM").trim();
    const punchesRaw = String(req.query.punches || "[]");
    const breaksRaw = String(req.query.breaks || "[]");

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!workDate) {
      return res.status(400).json({ error: "workDate required" });
    }

    const punches = JSON.parse(punchesRaw);
    const breaks = JSON.parse(breaksRaw);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        hourlyRateCents: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const calc = calculateTimeEntryTotals({
      workDate,
      shiftType,
      punches,
      breaks,
      hourlyRateCents: employee.hourlyRateCents,
    });

    return res.json({
      input: {
        workDate,
        shiftType,
        workedMinutes: calc.workedMinutes,
        breakMinutes: calc.breakMinutes,
        payableMinutes: calc.payableMinutes,
      },
      buckets: {
        regularMinutes: calc.regularMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        doubleMinutes: calc.doubleMinutes,
        regular_HHMM: fmtHHMM(calc.regularMinutes),
        overtime_HHMM: fmtHHMM(calc.overtimeMinutes),
        double_HHMM: fmtHHMM(calc.doubleMinutes),
      },
      pay: {
        hourlyRateCents: employee.hourlyRateCents,
        regularPayCents: calc.regularPayCents,
        overtimePayCents: calc.overtimePayCents,
        doublePayCents: calc.doublePayCents,
        grossPayCents: calc.grossPayCents,
      },
      display: {
        payableHours_HHMM: fmtHHMM(calc.payableMinutes),
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-correction/calc failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to calculate payroll correction" });
  }
});

router.post("/payroll-corrections", async (req, res) => {
  try {
    const {
      payrollRunId,
      payrollRunSnapshotId,
      employeeId,
      workDate,
      reason,
      originalSnapshotJson,
      correctedInputJson,
      correctedResultJson,
      adjustmentAmountCents,
    } = req.body || {};

    const runId = String(payrollRunId || "").trim();
    const snapshotId = String(payrollRunSnapshotId || "").trim();
    const empId = String(employeeId || "").trim();
    const workDateStr = String(workDate || "").trim();
    const reasonStr = String(reason || "").trim();
    const deltaCents = Number(adjustmentAmountCents);

    if (!runId) return res.status(400).json({ error: "payrollRunId required" });
    if (!snapshotId) return res.status(400).json({ error: "payrollRunSnapshotId required" });
    if (!empId) return res.status(400).json({ error: "employeeId required" });
    if (!workDateStr) return res.status(400).json({ error: "workDate required" });
    if (!reasonStr) return res.status(400).json({ error: "reason required" });
    if (!Number.isFinite(deltaCents) || deltaCents === 0) {
      return res.status(400).json({ error: "adjustmentAmountCents must be a non-zero number" });
    }

    const snapshot = await prisma.payrollRunEntrySnapshot.findFirst({
      where: {
        id: snapshotId,
        payrollRunId: runId,
        employeeId: empId,
      },
      select: {
        id: true,
        payrollRunId: true,
        employeeId: true,
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Payroll snapshot not found" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const createdById = (req as any)?.user?.sub ? String((req as any).user.sub) : null;

    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.payrollAdjustment.create({
        data: {
          employeeId: empId,
          amountCents: Math.round(deltaCents),
          reason: reasonStr,
          payrollRunId: null,
        },
      });

      const correction = await tx.payrollCorrection.create({
        data: {
          payrollRunId: runId,
          payrollRunSnapshotId: snapshotId,
          employeeId: empId,
          workDate: new Date(`${workDateStr}T00:00:00.000Z`),
          reason: reasonStr,
          originalSnapshotJson,
          correctedInputJson,
          correctedResultJson,
          adjustmentAmountCents: Math.round(deltaCents),
          payrollAdjustmentId: adjustment.id,
          createdById,
        },
      });

      return { adjustment, correction };
    });

    return res.json({
      ok: true,
      adjustment: result.adjustment,
      correction: result.correction,
    });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-corrections failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to create payroll correction" });
  }
});

export default router;
