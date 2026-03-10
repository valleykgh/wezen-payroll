import express from "express";
import { prisma } from "../../prisma";
import { requireFacilityPin } from "./_shared";

const router = express.Router();

router.get("/facilities", async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany({
      include: {
        rates: {
          orderBy: [{ effectiveFrom: "desc" }, { title: "asc" }],
        },
        billingContracts: {
          include: {
            rates: true,
          },
          orderBy: [{ effectiveFrom: "desc" }],
        },
      },
      orderBy: { name: "asc" },
    });

    return res.json({ facilities });
  } catch (e) {
    console.error("GET /api/admin/facilities failed:", e);
    return res.status(500).json({ error: "Failed to load facilities" });
  }
});

router.get("/facilities/:facilityId/rates", async (req, res) => {
  try {
    const { facilityId } = req.params;

    if (!facilityId) {
      return res.status(400).json({ error: "facilityId required" });
    }

    const rates = await prisma.facilityRate.findMany({
      where: { facilityId: String(facilityId) },
      orderBy: [{ title: "asc" }, { effectiveFrom: "desc" }],
    });

    return res.json({ facilityId, rates });
  } catch (e: any) {
    console.error("GET /api/admin/facilities/:facilityId/rates failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load facility rates" });
  }
});

router.get("/facilities/:facilityId/rate-check", async (req, res) => {
  try {
    const facilityId = String(req.params.facilityId || "").trim();
    const employeeId = String(req.query.employeeId || "").trim();
    const workDate = String(req.query.workDate || "").trim();

    if (!facilityId) {
      return res.status(400).json({ error: "facilityId required" });
    }
    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!workDate) {
      return res.status(400).json({ error: "workDate required" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        title: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const title = String(employee.title || "").trim();
    if (!title) {
      return res.json({
        ok: false,
        hasRate: false,
        reason: "Employee has no title",
        employeeTitle: null,
        facilityName: facility.name,
        effectiveRate: null,
      });
    }

    const workDateDt = new Date(`${workDate}T00:00:00.000Z`);
    if (Number.isNaN(workDateDt.getTime())) {
      return res.status(400).json({ error: "Invalid workDate" });
    }

    const rate = await prisma.facilityRate.findFirst({
      where: {
        facilityId,
        title: title as any,
        effectiveFrom: {
          lte: workDateDt,
        },
      },
      orderBy: {
        effectiveFrom: "desc",
      },
      select: {
        id: true,
        title: true,
        effectiveFrom: true,
        regRateCents: true,
        otRateCents: true,
        dtRateCents: true,
      },
    });

    return res.json({
      ok: true,
      hasRate: !!rate,
      reason: rate ? null : "Missing facility billing rate",
      employeeTitle: title,
      facilityName: facility.name,
      effectiveRate: rate,
    });
  } catch (e: any) {
    console.error("GET /api/admin/facilities/:facilityId/rate-check failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to check facility rate" });
  }
});

router.post("/facilities", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "name required" });
    }

    const exists = await prisma.facility.findFirst({
      where: { name: { equals: name, mode: "insensitive" as any } },
      select: { id: true, active: true },
    });

    if (exists) {
      return res.status(400).json({ error: "Facility already exists" });
    }

    const facility = await prisma.facility.create({
      data: {
        name,
        active: true,
      },
    });

    return res.json({ ok: true, facility });
  } catch (e: any) {
    console.error("POST /api/admin/facilities failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to create facility" });
  }
});

router.patch("/facilities/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    const active =
      typeof req.body?.active === "boolean" ? req.body.active : undefined;

    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.facility.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const data: any = {};
    if (name) data.name = name;
    if (typeof active === "boolean") data.active = active;

    const facility = await prisma.facility.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, facility });
  } catch (e: any) {
    console.error("PATCH /api/admin/facilities/:id failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to update facility" });
  }
});

router.post("/facilities/:id/archive", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.facility.findUnique({
      where: { id },
      select: { id: true, active: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const facility = await prisma.facility.update({
      where: { id },
      data: { active: false },
    });

    return res.json({ ok: true, facility });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/facilities/:id/archive failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to archive facility" });
  }
});

router.post("/facilities/:id/restore", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.facility.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const facility = await prisma.facility.update({
      where: { id },
      data: { active: true },
    });

    return res.json({ ok: true, facility });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/facilities/:id/restore failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to restore facility" });
  }
});

router.post("/facilities/:facilityId/rates", async (req, res) => {
  try {
    requireFacilityPin(req);

    const { facilityId } = req.params;
    const { title, effectiveFrom, regRateCents, otRateCents, dtRateCents } = req.body || {};

    if (!facilityId) {
      return res.status(400).json({ error: "facilityId required" });
    }

    if (!["CNA", "LVN", "RN"].includes(String(title))) {
      return res.status(400).json({ error: "title must be CNA|LVN|RN" });
    }

    if (!effectiveFrom) {
      return res.status(400).json({ error: "effectiveFrom required (YYYY-MM-DD)" });
    }

    const reg = Number(regRateCents);
    const ot = Number(otRateCents);
    const dt = Number(dtRateCents);

    if (![reg, ot, dt].every((n) => Number.isFinite(n) && n >= 0)) {
      return res.status(400).json({ error: "rates must be cents numbers >= 0" });
    }

    const effectiveFromDate = new Date(`${String(effectiveFrom)}T00:00:00.000Z`);
    if (Number.isNaN(effectiveFromDate.getTime())) {
      return res.status(400).json({ error: "effectiveFrom must be a valid YYYY-MM-DD date" });
    }

    const existing = await prisma.facilityRate.findFirst({
      where: {
        facilityId: String(facilityId),
        title: String(title) as any,
        effectiveFrom: effectiveFromDate,
      },
      select: { id: true },
    });

    let rate;
    if (existing) {
      rate = await prisma.facilityRate.update({
        where: { id: existing.id },
        data: {
          regRateCents: Math.round(reg),
          otRateCents: Math.round(ot),
          dtRateCents: Math.round(dt),
        },
      });
    } else {
      rate = await prisma.facilityRate.create({
        data: {
          facilityId: String(facilityId),
          title: String(title) as any,
          effectiveFrom: effectiveFromDate,
          regRateCents: Math.round(reg),
          otRateCents: Math.round(ot),
          dtRateCents: Math.round(dt),
        },
      });
    }

    return res.json({ ok: true, rate });
  } catch (e: any) {
    console.error("POST /api/admin/facilities/:facilityId/rates failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to save facility rate" });
  }
});

export default router;
