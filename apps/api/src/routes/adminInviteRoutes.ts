import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/authMiddleware";
import crypto from "crypto";

export const adminInviteRoutes = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" });
  return next();
}

adminInviteRoutes.use(requireAuth, requireAdmin);

/**
 * POST /invites
 * Full path: POST /api/admin/invites
 * body: { employeeId }
 *
 * Creates an Invite ONLY (no User needed yet).
 * Employee will accept invite to create/activate their User & set password.
 */
adminInviteRoutes.post("/invites", async (req, res) => {
  try {
    const { employeeId } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, email: true, legalName: true, preferredName: true },
    });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invite = await prisma.invite.create({
      data: {
        token,
        employeeId: employee.id,
        email: employee.email,
        expiresAt,
      },
      select: { id: true, token: true, email: true, employeeId: true, expiresAt: true, usedAt: true },
    });

    const inviteUrl = `https://payroll.wezenstaffing.com/invite?token=${token}`;

    res.json({ invite, inviteUrl });
  } catch (e) {
    console.error("POST /api/admin/invites failed:", e);
    res.status(500).json({ error: "Failed to create invite" });
  }
});
