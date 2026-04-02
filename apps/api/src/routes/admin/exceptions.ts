import express from "express";
import { prisma } from "../../prisma";
import { getBillableWorkRows, startOfDayUTC, startOfNextDayUTC } from "./_shared";

const router = express.Router();

router.get("/exceptions", async (req, res) => {
  try {
    const { facilityId, from, to } = req.query as {
      facilityId?: string;
      from?: string;
      to?: string;
    };

    if (!from || !to) {
      return res.status(400).json({ error: "from and to required" });
    }

    const fromDate = startOfDayUTC(from);
    const toExclusive = startOfNextDayUTC(to);

    const rows = await getBillableWorkRows({
      prisma,
      facilityId: facilityId && facilityId !== "ALL" ? String(facilityId) : undefined,
      from: fromDate,
      toExclusive,
    });

    const addedAfterFinalized = rows.filter((r: any) => r.addedAfterFinalizedWeek);
    const needsSupplemental = rows.filter(
      (r: any) => !r.billedAt && r.invoiceType !== "REGULAR"
    );
    const unpaid = rows.filter(
      (r: any) => !r.payrollRunId && !r.paidNow
    );
    const adjustments = rows.filter(
      (r: any) => r.sourceType === "PAYROLL_ADJUSTMENT"
    );

    return res.json({
      addedAfterFinalized,
      needsSupplemental,
      unpaid,
      adjustments,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to load exceptions" });
  }
});

export default router;
