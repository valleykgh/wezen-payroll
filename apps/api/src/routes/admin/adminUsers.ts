import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../prisma";
import { requireAuth } from "../../middleware/authMiddleware";
import { requireRole } from "../../middleware/requireRole";

const router = Router();

router.use(requireAuth, requireRole("SUPER_ADMIN"));

router.get("/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        passwordUpdatedAt: true,
        lastLoginAt: true,
        employeeId: true,
        createdAt: true,
      },
    });

    res.json({ users });
  } catch (e) {
    console.error("GET /api/admin/users failed:", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      temporaryPassword,
      active,
      mustChangePassword,
      employeeId,
    } = req.body || {};

    if (!email || !role || !temporaryPassword) {
      return res.status(400).json({ error: "email, role, temporaryPassword required" });
    }

    const passwordHash = await bcrypt.hash(String(temporaryPassword), 10);

    const user = await prisma.user.create({
      data: {
        name: name ? String(name) : null,
        email: String(email).toLowerCase(),
        role,
        passwordHash,
        active: active !== false,
        mustChangePassword: mustChangePassword !== false,
        passwordUpdatedAt: new Date(),
        employeeId: employeeId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        employeeId: true,
      },
    });

    res.json({ user });
  } catch (e: any) {
    console.error("POST /api/admin/users failed:", e);
    res.status(500).json({ error: e?.message || "Failed to create user" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const { name, role, active, employeeId, mustChangePassword } = req.body || {};

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name ? String(name) : null } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(active !== undefined ? { active: !!active } : {}),
        ...(employeeId !== undefined ? { employeeId: employeeId || null } : {}),
        ...(mustChangePassword !== undefined ? { mustChangePassword: !!mustChangePassword } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        employeeId: true,
      },
    });

    res.json({ user });
  } catch (e: any) {
    console.error("PATCH /api/admin/users/:id failed:", e);
    res.status(500).json({ error: e?.message || "Failed to update user" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const { temporaryPassword } = req.body || {};

    if (!temporaryPassword) {
      return res.status(400).json({ error: "temporaryPassword required" });
    }

    const passwordHash = await bcrypt.hash(String(temporaryPassword), 10);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordUpdatedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/admin/users/:id/reset-password failed:", e);
    res.status(500).json({ error: e?.message || "Failed to reset password" });
  }
});

export default router;
