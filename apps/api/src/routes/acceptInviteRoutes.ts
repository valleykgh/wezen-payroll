import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";

const router = Router();

router.post("/invite/accept", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "token and password required" });
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { employee: true },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invalid invite" });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: "Invite already used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invite expired" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: invite.employee.email,
        passwordHash,
        role: "EMPLOYEE",
        employeeId: invite.employee.id,
        active: true,
        passwordUpdatedAt: new Date(),
      },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("Accept invite failed:", e);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

export default router;
