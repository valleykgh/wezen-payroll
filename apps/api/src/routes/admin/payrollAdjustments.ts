import express from "express";
import { prisma } from "../../prisma";

const router = express.Router();

// GET /api/admin/payroll-adjustments
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

// POST /api/admin/payroll-adjustments
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

export default router;
