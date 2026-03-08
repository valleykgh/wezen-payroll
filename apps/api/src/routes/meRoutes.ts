import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/authMiddleware";

export const meRoutes = Router();

meRoutes.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id; // requireAuth must set this
    if (!userId) return res.status(401).json({ error: "Invalid token (no user id)" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        employeeId: true,
        employee: { select: { id: true, legalName: true, preferredName: true, hourlyRateCents: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (e) {
    console.error("GET /api/me failed:", e);
    res.status(500).json({ error: "Failed to load current user" });
  }
});
