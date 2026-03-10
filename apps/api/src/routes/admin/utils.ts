import express from "express";
import { requireAdminPinFromBody } from "./_shared";

const router = express.Router();

router.post("/verify-pin", async (req, res) => {
  try {
    requireAdminPinFromBody(req);
    return res.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/verify-pin failed:", e);
    return res.status(status).json({ error: e?.message || "PIN verification failed" });
  }
});

export default router;
