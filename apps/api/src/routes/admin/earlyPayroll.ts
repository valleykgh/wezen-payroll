import express from "express";
import { prisma } from "../../prisma";

const router = express.Router();

function startOfDayUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function requireAdminPin(req: any) {
  const pin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
  const expected = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

  if (!expected) {
    const err: any = new Error("Admin PIN is not configured");
    err.status = 500;
    throw err;
  }

  if (!pin || pin !== expected) {
    const err: any = new Error("Invalid PIN");
    err.status = 403;
    throw err;
  }
}

router.get("/early-payroll", async (req, res) => {
  try {
    const periodStart = String(req.query.periodStart || "").trim();
    const periodEnd = String(req.query.periodEnd || "").trim();

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd required" });
    }

    const rows = await prisma.earlyPayrollPayment.findMany({
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
  } catch (e: any) {
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

    const employee = await prisma.employee.findUnique({
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

    const createdById =
      (req as any)?.user?.sub
        ? String((req as any).user.sub)
        : ((req as any)?.user?.id ? String((req as any).user.id) : null);

    const existing = await prisma.earlyPayrollPayment.findFirst({
      where: {
        employeeId,
        periodStart: startOfDayUTC(periodStart),
        periodEnd: startOfDayUTC(periodEnd),
      },
      select: {
        id: true,
        amountCents: true,
        paidAt: true,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: "This employee is already marked paid early for that pay period.",
      });
    }

    const earlyPayment = await prisma.earlyPayrollPayment.create({
      data: {
        employeeId,
        periodStart: startOfDayUTC(periodStart),
        periodEnd: startOfDayUTC(periodEnd),
        amountCents: Math.round(amountCents),
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

    return res.json({ ok: true, earlyPayment });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/early-payroll failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to create early payroll payment" });
  }
});

router.delete("/early-payroll/:id", async (req, res) => {
  try {
    requireAdminPin(req);

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.earlyPayrollPayment.findUnique({
      where: { id },
      select: {
        id: true,
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

    await prisma.earlyPayrollPayment.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("DELETE /api/admin/early-payroll/:id failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to delete early payroll payment" });
  }
});

export default router;
