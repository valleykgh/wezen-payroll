import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { signToken } from "../auth";
import { requireAuth } from "../middleware/authMiddleware";

export const authRoutes = Router();

/**
 * Employee self-signup:
 * - creates Employee
 * - creates User linked to Employee
 */
authRoutes.post("/register", async (req, res) => {
  const { email, password, legalName, preferredName } = req.body || {};
  if (!email || !password || !legalName) {
    return res.status(400).json({ error: "email, password, legalName are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);

  const employee = await prisma.employee.create({
    data: { email, legalName, preferredName: preferredName ?? null, hourlyRateCents: 0, active: true },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "EMPLOYEE",
      employeeId: employee.id,
      active: true,
    mustChangePassword: false,
    passwordUpdatedAt: new Date(),   
},
  });

  const token = signToken({ sub: user.id, role: user.role, employeeId: user.employeeId });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
    mustChangePassword: user.mustChangePassword,
  });
});

authRoutes.post("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: "newPassword must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.active) return res.status(403).json({ error: "User is inactive" });

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "currentPassword required" });
      }

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid current password" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordUpdatedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/change-password failed:", e);
    res.status(500).json({ error: "Failed to change password" });
  }
});

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      employeeId: true,
      active: true,
      mustChangePassword: true,
    },
  });

  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.active) return res.status(403).json({ error: "User is inactive" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({
    sub: user.id,
    role: user.role,
    employeeId: user.employeeId,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    },
    mustChangePassword: user.mustChangePassword,
  });
});

authRoutes.post("/accept-invite", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "token and password required" });

    const invite = await prisma.invite.findUnique({
      where: { token: String(token) },
      select: {
        id: true,
        employeeId: true,
        email: true,
        expiresAt: true,
        usedAt: true,
        employee: { select: { id: true, email: true } },
      },
    });

    if (!invite) return res.status(400).json({ error: "Invalid invite token" });
    if (invite.usedAt) return res.status(400).json({ error: "Invite already used" });
    if (new Date(invite.expiresAt).getTime() < Date.now()) return res.status(400).json({ error: "Invite expired" });

    // Prefer invite.email if present, else employee.email
    const email = invite.email ?? invite.employee?.email;
    if (!email) return res.status(400).json({ error: "Invite missing employee email" });

    const employeeId = invite.employee?.id ?? invite.employeeId;
    if (!employeeId) return res.status(404).json({ error: "Employee not found" });

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user if missing; otherwise set password

    const user = await prisma.user.upsert({
  where: { email },
  update: {
    passwordHash,
    employeeId,
    role: "EMPLOYEE",
    active: true,
    mustChangePassword: false,
    passwordUpdatedAt: new Date(),
  },
  create: {
    email,
    passwordHash,
    role: "EMPLOYEE",
    employeeId,
    active: true,
    mustChangePassword: false,
    passwordUpdatedAt: new Date(),
  },
  select: {
    id: true,
    email: true,
    role: true,
    employeeId: true,
    mustChangePassword: true,
  },
});   

    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    const jwt = signToken({ sub: user.id, role: user.role, employeeId: user.employeeId });

    res.json({ token: jwt, user });
  } catch (e) {
    console.error("POST /api/auth/accept-invite failed:", e);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});
