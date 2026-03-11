import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/requireRole";
import { sendEmployeeInviteEmail } from "../lib/email";

const router = Router();

router.use(requireAuth, requireRole("SUPER_ADMIN", "HR_ADMIN"));

router.post("/employees/:employeeId/invite", async (req, res) => {
  try {
    const employeeId = String(req.params.employeeId);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const invite = await prisma.invite.create({
      data: {
        employeeId,
        email: employee.email,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: req.user?.id,
      },
    });

    const frontendBase = String(
      process.env.FRONTEND_URL || "https://payroll.wezenstaffing.com"
    ).replace(/\/+$/, "");

    const inviteUrl = `${frontendBase}/employee/setup-password?token=${token}`;

    let emailSent = false;
let emailError: string | null = null;

try {
  await sendEmployeeInviteEmail({
    to: employee.email,
    employeeName: employee.preferredName || employee.legalName,
    inviteUrl,
  });
  emailSent = true;
} catch (e: any) {
  console.error("Invite email send failed:", e);
  emailError = e?.message || "Email send failed";
}

res.json({
  invite,
  inviteUrl,
  emailSent,
  emailError,
}); 

 } catch (e) {
    console.error("Create invite failed:", e);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

export default router;
