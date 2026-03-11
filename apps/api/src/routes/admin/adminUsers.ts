import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../prisma";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/authMiddleware";

const router = Router();

/**
 * SUPER_ADMIN only for now.
 * Later we can relax list/view to HR_ADMIN if desired.
 */
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
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
          },
        },
      },
    });

    res.json({ users });
  } catch (e) {
    console.error("GET /api/admin/users failed:", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/users", async (req: AuthRequest, res) => {
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

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(role || "").trim().toUpperCase();

    if (!normalizedEmail || !normalizedRole || !temporaryPassword) {
      return res.status(400).json({ error: "email, role, temporaryPassword required" });
    }

    if (
      normalizedRole !== "SUPER_ADMIN" &&
      normalizedRole !== "PAYROLL_ADMIN" &&
      normalizedRole !== "HR_ADMIN" &&
      normalizedRole !== "EMPLOYEE"
    ) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(String(temporaryPassword), 10);

    const user = await prisma.user.create({
      data: {
        name: name ? String(name).trim() : null,
        email: normalizedEmail,
        role: normalizedRole as any,
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

router.patch("/users/:id", async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id || "");
    const { name, role, active, employeeId, mustChangePassword } = req.body || {};

    if (!id) return res.status(400).json({ error: "User id required" });
    
    const actorUserId = req.user?.id;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        active: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (actorUserId === existingUser.id && active === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    if (existingUser.role === "SUPER_ADMIN" && active === false) {
      const activeSuperAdminCount = await prisma.user.count({
        where: {
          role: "SUPER_ADMIN",
          active: true,
        },
      });

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({ error: "Cannot deactivate the last active SUPER_ADMIN" });
      }
    }

    const data: Record<string, any> = {};

    if (name !== undefined) {
      data.name = name ? String(name).trim() : null;
    }

    if (role !== undefined) {
      const normalizedRole = String(role).trim().toUpperCase();
      if (
        normalizedRole !== "SUPER_ADMIN" &&
        normalizedRole !== "PAYROLL_ADMIN" &&
        normalizedRole !== "HR_ADMIN" &&
        normalizedRole !== "EMPLOYEE"
      ) {
        return res.status(400).json({ error: "Invalid role" });
      }
      data.role = normalizedRole;
    }

    if (active !== undefined) {
      data.active = !!active;
    }

    if (employeeId !== undefined) {
      data.employeeId = employeeId || null;
    }

    if (mustChangePassword !== undefined) {
      data.mustChangePassword = !!mustChangePassword;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
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
    if (e?.code === "P2025") {
    return res.status(404).json({ error: "User not found" });
  }
   return res.status(500).json({ error: e?.message || "Failed to reset password" });
  }
});

router.post("/users/:id/reset-password", async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id || "");
    const { temporaryPassword } = req.body || {};

    if (!id) return res.status(400).json({ error: "User id required" });
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
    if (e?.code === "P2025") {
    return res.status(404).json({ error: "User not found" });
  }
    return res.status(500).json({ error: e?.message || "Failed to reset password" });
  }
});

router.delete("/users/:id", async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id || "");
    const actorUserId = req.user?.id;

    if (!id) {
      return res.status(400).json({ error: "User id required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        employeeId: true,
        _count: {
          select: {
            createdTimeEntries: true,
            createdInvites: true,
            lockedFacilityBillingContracts: true,
            payrollRunsCreated: true,
            earlyPayrollPaymentsCreated: true,
          },
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (actorUserId === existingUser.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    if (existingUser.role === "SUPER_ADMIN") {
      return res.status(400).json({ error: "SUPER_ADMIN users cannot be deleted" });
    }

    const hasReferences =
      existingUser._count.createdTimeEntries > 0 ||
      existingUser._count.createdInvites > 0 ||
      existingUser._count.lockedFacilityBillingContracts > 0 ||
      existingUser._count.payrollRunsCreated > 0 ||
      existingUser._count.earlyPayrollPaymentsCreated > 0;

    if (hasReferences) {
      return res.status(400).json({
        error: "User cannot be deleted because the account is referenced by system records. Deactivate it instead.",
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/admin/users/:id failed:", e);

    if (e?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(500).json({ error: e?.message || "Failed to delete user" });
  }
});

export default router;
