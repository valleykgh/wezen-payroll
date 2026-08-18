import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { sendEmployeeInviteEmail } from "../lib/email";

export const staffingIntegrationRoutes = Router();

function authorized(req: any) {
  const expected = Buffer.from(String(process.env.PAYROLL_INTEGRATION_SECRET || ""));
  const received = Buffer.from(String(req.headers["x-integration-secret"] || ""));
  return expected.length > 0 && expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

staffingIntegrationRoutes.post("/staffing/employee", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized integration request" });
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const legalName = String(req.body?.legalName || "").trim();
    const employeeCode = String(req.body?.employeeCode || "").trim();
    const ssnLast4 = String(req.body?.ssnLast4 || "").replace(/\D/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !legalName || !employeeCode) {
      return res.status(400).json({ error: "email, legalName, and employeeCode are required" });
    }
    if (ssnLast4 && !/^\d{4}$/.test(ssnLast4)) return res.status(400).json({ error: "ssnLast4 must contain four digits" });

    const employee = await prisma.employee.upsert({
      where: { email },
      update: {
        legalName,
        employeeCode,
        active: true,
        addressLine1: String(req.body?.addressLine1 || "").trim() || null,
        addressLine2: String(req.body?.addressLine2 || "").trim() || null,
        city: String(req.body?.city || "").trim() || null,
        state: String(req.body?.state || "").trim() || null,
        zip: String(req.body?.zip || "").replace(/\D/g, "") || null,
        ssnLast4: ssnLast4 || null,
      },
      create: {
        email,
        legalName,
        employeeCode,
        active: true,
        title: ["CNA", "LVN", "RN"].includes(String(req.body?.title || "").toUpperCase()) ? String(req.body.title).toUpperCase() as any : "CNA",
        addressLine1: String(req.body?.addressLine1 || "").trim() || null,
        addressLine2: String(req.body?.addressLine2 || "").trim() || null,
        city: String(req.body?.city || "").trim() || null,
        state: String(req.body?.state || "").trim() || null,
        zip: String(req.body?.zip || "").replace(/\D/g, "") || null,
        ssnLast4: ssnLast4 || null,
      },
      select: { id: true, email: true, legalName: true, preferredName: true, user: { select: { id: true } } },
    });

    const staffingProfessionalId = String(req.body?.staffingProfessionalId || "").trim();
    if (staffingProfessionalId) {
      await prisma.employeeExternalMapping.upsert({
        where: { externalSystem_externalEmployeeId: { externalSystem: "WEZEN_STAFFING", externalEmployeeId: staffingProfessionalId } },
        update: { employeeId: employee.id, staffingProfessionalId, active: true },
        create: { employeeId: employee.id, staffingProfessionalId, externalSystem: "WEZEN_STAFFING", externalEmployeeId: staffingProfessionalId, active: true },
      });
    }

    let invitationSent = false;
    if (!employee.user) {
      let invite = await prisma.invite.findFirst({ where: { employeeId: employee.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
      if (!invite) {
        invite = await prisma.invite.create({ data: { employeeId: employee.id, email, token: crypto.randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
      }
      const base = String(process.env.FRONTEND_URL || "https://payroll.wezenstaffing.com").replace(/\/+$/, "");
      await sendEmployeeInviteEmail({ to: email, employeeName: employee.preferredName || employee.legalName, inviteUrl: `${base}/employee/setup-password?token=${invite.token}` });
      invitationSent = true;
    }
    return res.json({ ok: true, employeeId: employee.id, invitationSent, activated: Boolean(employee.user), payrollMappingPending: true });
  } catch (error: any) {
    console.error("POST /api/integrations/staffing/employee failed", error);
    if (error?.code === "P2002") return res.status(409).json({ error: "Employee code is already assigned" });
    return res.status(500).json({ error: error?.message || "Failed to provision payroll employee" });
  }
});
