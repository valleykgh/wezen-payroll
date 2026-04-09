import express from "express";
import { prisma } from "../../prisma";

const router = express.Router();

router.post("/system/reset-live-test", async (req, res) => {
  try {
    const pinFromHeader = String(req.headers["x-admin-pin"] || "").trim();
    const pinFromBody = String(req.body?.pin || "").trim();
    const confirmation = String(req.body?.confirmation || "").trim();

    const expectedPin = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

    if (!expectedPin) {
      return res.status(500).json({ error: "ADMIN_OVERRIDE_PIN is not configured" });
    }

    const suppliedPin = pinFromHeader || pinFromBody;
    if (!suppliedPin || suppliedPin !== expectedPin) {
      return res.status(403).json({ error: "Invalid admin PIN" });
    }

    if (confirmation !== "RESET") {
      return res.status(400).json({ error: 'Type "RESET" to confirm' });
    }

    const allowReset = String(process.env.ALLOW_TEST_RESET || "")
      .trim()
      .toLowerCase();

    if (allowReset !== "true") {
      return res.status(403).json({
        error: "Environment reset is disabled. Enable ALLOW_TEST_RESET=true to allow.",
      });
    }

const results = await prisma.$transaction(async (tx) => {
  const out: Record<string, any> = {};

  const maybeDeleteMany = async (label: string, modelName: string) => {
    const model = (tx as any)[modelName];
    if (!model || typeof model.deleteMany !== "function") {
      out[label] = { skipped: true, reason: `Model ${modelName} not found` };
      return;
    }
    out[label] = await model.deleteMany({});
  };

await maybeDeleteMany("loanDeduction", "loanDeduction");
await maybeDeleteMany("employeeLoan", "employeeLoan");
await maybeDeleteMany("earlyPayrollPayment", "earlyPayrollPayment");
await maybeDeleteMany("payrollCorrection", "payrollCorrection");
await maybeDeleteMany("payrollRunEntrySnapshot", "payrollRunEntrySnapshot");
await maybeDeleteMany("payrollRunEmployee", "payrollRunEmployee");
await maybeDeleteMany("payrollAdjustment", "payrollAdjustment");
await maybeDeleteMany("timeEntryBreak", "timeEntryBreak");
await maybeDeleteMany("timeEntry", "timeEntry");
await maybeDeleteMany("employeePayrollLedger", "employeePayrollLedger");
await maybeDeleteMany("billingRun", "billingRun");
await maybeDeleteMany("payrollRun", "payrollRun");
await maybeDeleteMany("invite", "invite");
await maybeDeleteMany("employee", "employee");
  return out;
});
    return res.json({
      ok: true,
      message: "Live test environment reset completed.",
      results,
    });
  } catch (e: any) {
    console.error("POST /api/admin/system/reset-live-test failed:", e);
    return res.status(500).json({ error: e?.message || "Reset failed" });
  }
});
export default router;
