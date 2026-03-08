import express from "express";
import ExcelJS from "exceljs";
import { prisma } from "../prisma";
import { signToken } from "../auth";

const adminTimeRoutes = express.Router();

// =====================================================
// TYPES / CONSTANTS
// =====================================================

const TIME_ENTRY_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;

const SHIFT_TYPE = {
  AM: "AM",
  PM: "PM",
  NOC: "NOC",
  AM_PM: "AM+PM",
  PM_NOC: "PM+NOC",
  NOC_AM: "NOC+AM",
} as const;

const MAX_GAP_MINUTES = 120;

type Punch = {
  clockIn: string;
  clockOut: string;
};

type BreakInput = {
  startTime: string;
  endTime: string;
};

type Segment = {
  shift: "AM" | "PM" | "NOC";
  punches: Punch[];
};

// =====================================================
// PIN HELPERS
// =====================================================

function requireAdminPinFromBody(req: any) {
  const providedPin = String(req.body?.pin || "").trim();
  const expectedPin = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

  if (!expectedPin) {
    const err: any = new Error("ADMIN_OVERRIDE_PIN is not configured on the server");
    err.status = 500;
    throw err;
  }

  if (!providedPin) {
    const err: any = new Error("PIN required");
    err.status = 403;
    throw err;
  }

  if (providedPin !== expectedPin) {
    const err: any = new Error("Invalid PIN");
    err.status = 403;
    throw err;
  }
}

function requireFacilityPin(req: any) {
  const pin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
  const expected = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

  if (!expected) {
    const err: any = new Error("Admin PIN is not configured");
    err.status = 500;
    throw err;
  }

  if (!pin || pin !== expected) {
    const err: any = new Error("Invalid PIN");
    err.status = 403;
    throw err;
  }
}

function requireLoanPin(req: any) {
  const pin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
  const expected = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

  if (!expected) {
    const err: any = new Error("Admin PIN is not configured");
    err.status = 500;
    throw err;
  }

  if (!pin || pin !== expected) {
    const err: any = new Error("Invalid PIN");
    err.status = 403;
    throw err;
  }
}

// =====================================================
// GENERAL HELPERS
// =====================================================

function startOfDayUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function startOfNextDayUTC(iso: string) {
  const d = startOfDayUTC(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function listDatesInclusive(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }

  return out;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function fmtHHMM(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function minutesToDecimalHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

function fmtISODateOnly(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function fmtWeekdayShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function safeSheetName(name: string) {
  return String(name || "Sheet")
    .replace(/[\\/*?:[\]]/g, "")
    .slice(0, 31);
}

function currencyExcel(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function isoToDisplayTime(v?: string | null): string {
  const s = String(v || "").trim();
  if (!s) return "";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");

  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  return `${h}:${m} ${ampm}`;
}

function parseTimeOnDate(workDateISO: string, timeStr: string): Date {
  const s = (timeStr || "").trim();
  if (!s) throw new Error("Invalid time");

  if (s.includes("T")) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid datetime: ${s}`);
    return d;
  }

  const base = new Date(`${workDateISO}T00:00:00`);
  if (Number.isNaN(base.getTime())) throw new Error("Invalid workDate");

  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const hh = Number(m24[1]);
    const mm = Number(m24[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error("Invalid time");
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let hh = Number(m12[1]);
    const mm = Number(m12[2]);
    const ap = m12[3].toUpperCase();

    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) throw new Error("Invalid time");

    if (ap === "AM") {
      if (hh === 12) hh = 0;
    } else {
      if (hh !== 12) hh += 12;
    }

    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  throw new Error(`Unsupported time format: ${timeStr}`);
}

function splitDailyBuckets(payableMinutes: number) {
  const m = Math.max(0, Math.floor(payableMinutes));
  const regularCap = 8 * 60;
  const otCap = 12 * 60;

  const regularMinutes = Math.min(m, regularCap);
  const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
  const doubleMinutes = Math.max(0, m - otCap);

  return { regularMinutes, overtimeMinutes, doubleMinutes };
}

function sumBreakMinutesFromEntry(e: any): number {
  const breaks: Array<{ minutes: number | null }> = Array.isArray(e.breaks) ? e.breaks : [];
  if (breaks.length > 0) {
    return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
  }
  return Number(e.breakMinutes ?? 0);
}

function buildPunchKey(
  punches: Array<{ clockIn: string; clockOut: string }>,
  breaks: Array<{ startTime: string; endTime: string }>
) {
  const p = (Array.isArray(punches) ? punches : [])
    .map((x) => `${String(x.clockIn || "").trim()}-${String(x.clockOut || "").trim()}`)
    .join("|");

  const b = (Array.isArray(breaks) ? breaks : [])
    .map((x) => `${String(x.startTime || "").trim()}-${String(x.endTime || "").trim()}`)
    .join("|");

  return `${p}__${b}`;
}

function computeWorkedMinutes(workDate: string, punches: Punch[]) {
  if (!Array.isArray(punches) || punches.length === 0) {
    throw new Error("punches required");
  }

  let worked = 0;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;

  for (const p of punches) {
    if (!p?.clockIn || !p?.clockOut) {
      throw new Error("Each punch must include clockIn and clockOut");
    }

    const cin = parseTimeOnDate(workDate, String(p.clockIn));
    let cout = parseTimeOnDate(workDate, String(p.clockOut));

    if (cout.getTime() <= cin.getTime()) {
      cout = new Date(cout.getTime() + 24 * 60 * 60 * 1000);
    }

    if (!firstIn || cin.getTime() < firstIn.getTime()) firstIn = cin;
    if (!lastOut || cout.getTime() > lastOut.getTime()) lastOut = cout;

    worked += minutesBetween(cin, cout);
  }

  return { workedMinutes: worked, firstIn: firstIn!, lastOut: lastOut! };
}

function isCombinablePair(a: "AM" | "PM" | "NOC", b: "AM" | "PM" | "NOC") {
  if ((a === "AM" && b === "NOC") || (a === "NOC" && b === "AM")) return false;

  return (
    (a === "AM" && b === "PM") ||
    (a === "PM" && b === "NOC") ||
    (a === "NOC" && b === "AM")
  );
}

function validateTwoSegmentContinuity(
  a: { shift: "AM" | "PM" | "NOC"; firstIn: Date; lastOut: Date },
  b: { shift: "AM" | "PM" | "NOC"; firstIn: Date; lastOut: Date }
) {
  if (!isCombinablePair(a.shift, b.shift)) {
    throw new Error(
      `Shifts ${a.shift} and ${b.shift} are not continuous. Create separate entries (no OT/DT across).`
    );
  }

  const gap = minutesBetween(a.lastOut, b.firstIn);
  if (gap > MAX_GAP_MINUTES) {
    throw new Error(`Gap ${gap} minutes > ${MAX_GAP_MINUTES}. Not continuous; create separate entries.`);
  }

  return gap;
}

function computeBreakRows(workDate: string, breaks: BreakInput[]) {
  if (!Array.isArray(breaks)) return [];

  const rows: { startTime: Date; endTime: Date; minutes: number }[] = [];

  for (const b of breaks) {
    if (!b?.startTime || !b?.endTime) {
      throw new Error("Each break must include startTime and endTime");
    }

    const bs = parseTimeOnDate(workDate, String(b.startTime));
    let be = parseTimeOnDate(workDate, String(b.endTime));

    if (be.getTime() <= bs.getTime()) {
      be = new Date(be.getTime() + 24 * 60 * 60 * 1000);
    }

    const mins = minutesBetween(bs, be);
    if (mins < 30) throw new Error("Each break must be at least 30 minutes");

    rows.push({ startTime: bs, endTime: be, minutes: mins });
  }

  return rows;
}
function findEffectiveFacilityRate(
  rates: Array<{
    title: string;
    effectiveFrom: Date;
    regRateCents: number;
    otRateCents: number;
    dtRateCents: number;
  }>,
  title: string,
  workDate: Date
) {
  const matches = rates.filter(
    (r) =>
      String(r.title) === String(title) &&
      new Date(r.effectiveFrom).getTime() <= new Date(workDate).getTime()
  );

  if (matches.length === 0) return null;

  matches.sort(
    (a, b) =>
      new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );

  return matches[0];
}
function calculateTimeEntryTotals(args: {
  workDate: string;
  shiftType: string;
  punches: Array<{ clockIn: string; clockOut: string }>;
  breaks: Array<{ startTime: string; endTime: string }>;
  hourlyRateCents: number;
}) {
  const { workDate, punches, breaks, hourlyRateCents } = args;

  let workedMinutes = 0;
  for (const p of punches || []) {
    if (!p?.clockIn || !p?.clockOut) continue;

    const inAt = parseTimeOnDate(workDate, String(p.clockIn));
    let outAt = parseTimeOnDate(workDate, String(p.clockOut));

    if (outAt.getTime() <= inAt.getTime()) {
      outAt = new Date(outAt.getTime() + 24 * 60 * 60 * 1000);
    }

    workedMinutes += minutesBetween(inAt, outAt);
  }

  let breakMinutes = 0;
  for (const b of breaks || []) {
    if (!b?.startTime || !b?.endTime) continue;

    const startAt = parseTimeOnDate(workDate, String(b.startTime));
    let endAt = parseTimeOnDate(workDate, String(b.endTime));

    if (endAt.getTime() <= startAt.getTime()) {
      endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
    }

    breakMinutes += minutesBetween(startAt, endAt);
  }

  const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
  const buckets = splitDailyBuckets(payableMinutes);

  const rateCents = Number(hourlyRateCents || 0);
  const regularPayCents = Math.round((buckets.regularMinutes * rateCents) / 60);
  const overtimePayCents = Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60);
  const doublePayCents = Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
  const grossPayCents = regularPayCents + overtimePayCents + doublePayCents;

  return {
    workedMinutes,
    breakMinutes,
    payableMinutes,
    regularMinutes: buckets.regularMinutes,
    overtimeMinutes: buckets.overtimeMinutes,
    doubleMinutes: buckets.doubleMinutes,
    regularPayCents,
    overtimePayCents,
    doublePayCents,
    grossPayCents,
  };
}

async function assertFacilityRateExists(args: {
  employeeId: string;
  facilityId: string;
  workDate: string;
}) {
  const { employeeId, facilityId, workDate } = args;

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
    const err: any = new Error("Employee not found");
    err.status = 404;
    throw err;
  }

  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!facility) {
    const err: any = new Error("Invalid facilityId");
    err.status = 400;
    throw err;
  }

  const title = String(employee.title || "").trim();
  if (!title) {
    const employeeName = employee.preferredName
      ? `${employee.legalName} (${employee.preferredName})`
      : employee.legalName;

    const err: any = new Error(
      `Employee "${employeeName}" has no designation/title. Please set CNA/LVN/RN before saving time entries.`
    );
    err.status = 400;
    throw err;
  }

  const workDateDt = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(workDateDt.getTime())) {
    const err: any = new Error("Invalid workDate");
    err.status = 400;
    throw err;
  }

  const rates = await prisma.facilityRate.findMany({
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
    take: 1,
  });

  const rate = rates[0] || null;

  if (!rate) {
    const employeeName = employee.preferredName
      ? `${employee.legalName} (${employee.preferredName})`
      : employee.legalName;

    const err: any = new Error(
      `Missing billing rate for facility "${facility.name}", title "${title}", work date ${workDate}. Please add the facility billing rate before saving a time entry for ${employeeName}.`
    );
    err.status = 400;
    throw err;
  }

  return {
    employee,
    facility,
    rate,
  };
}

async function assertEditableNotLocked(timeEntryId: string) {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
    select: { id: true, status: true },
  });

  if (!entry) return { ok: false as const, http: 404, msg: "Time entry not found" };

  if (entry.status === "LOCKED") {
    return { ok: false as const, http: 409, msg: "Time entry is LOCKED and cannot be edited" };
  }

  return { ok: true as const };
}

// =====================================================
// FACILITIES
// =====================================================

adminTimeRoutes.get("/facilities", async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany({
      orderBy: { name: "asc" },
    });
    return res.json({ facilities });
  } catch (e) {
    console.error("GET /api/admin/facilities failed:", e);
    return res.status(500).json({ error: "Failed to load facilities" });
  }
});

adminTimeRoutes.post("/facilities", async (req, res) => {
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

adminTimeRoutes.patch("/facilities/:id", async (req, res) => {
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

adminTimeRoutes.post("/facilities/:id/archive", async (req, res) => {
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

adminTimeRoutes.post("/facilities/:id/restore", async (req, res) => {
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

adminTimeRoutes.get("/facilities/:facilityId/rates", async (req, res) => {
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

adminTimeRoutes.post("/facilities/:facilityId/rates", async (req, res) => {
  try {
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

// =====================================================
// EMPLOYEES
// =====================================================

adminTimeRoutes.post("/employees", async (req, res) => {
  try {
    const { legalName, preferredName, hourlyRateCents, title } = req.body || {};
    const email = String(req.body.email || "").trim().toLowerCase();

    const ssnLast4Raw = req.body.ssnLast4 == null ? "" : String(req.body.ssnLast4);
    const zipRaw = req.body.zip == null ? "" : String(req.body.zip);

    const ssnLast4 = ssnLast4Raw.replace(/\D/g, "");
    const zip = zipRaw.replace(/\D/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (ssnLast4 && !/^\d{4}$/.test(ssnLast4)) {
      return res.status(400).json({ error: "SSN last 4 must be exactly 4 digits" });
    }

    if (zip && !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "Zip must be exactly 5 digits" });
    }

    const rawTitle = String(title ?? "").trim().toUpperCase();

    if (!legalName || !email || hourlyRateCents == null || !rawTitle) {
      return res.status(400).json({ error: "legalName, email, hourlyRateCents, title required" });
    }

    if (!["CNA", "LVN", "RN"].includes(rawTitle)) {
      return res.status(400).json({ error: "title must be CNA|LVN|RN" });
    }

    const employee = await prisma.employee.create({
      data: {
        legalName,
        preferredName: preferredName ?? null,
        email,
        hourlyRateCents: Number(hourlyRateCents),
        active: true,
        title: rawTitle as any,
        addressLine1: req.body.addressLine1 || null,
        addressLine2: req.body.addressLine2 || null,
        city: req.body.city || null,
        state: req.body.stateProv || req.body.state || null,
        zip: zip || null,
        ssnLast4: ssnLast4 || null,
      },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
      },
    });

    return res.json({ employee });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return res.status(409).json({
        error: "Employee already exists (duplicate email or unique field).",
      });
    }

    console.error("POST /api/admin/employees failed:", e);
    return res.status(500).json({ error: "Failed to create employee" });
  }
});

adminTimeRoutes.get("/employees", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
        ssnLast4: true,
        createdAt: true,
      },
    });
    res.json({ employees });
  } catch (e) {
    console.error("GET /api/admin/employees failed:", e);
    res.status(500).json({ error: "Failed to load employees" });
  }
});

adminTimeRoutes.patch("/employees/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const data: any = {};

    if (req.body.legalName !== undefined) data.legalName = String(req.body.legalName || "").trim();
    if (req.body.preferredName !== undefined) data.preferredName = String(req.body.preferredName || "").trim() || null;
    if (req.body.email !== undefined) data.email = String(req.body.email || "").trim();
    if (req.body.title !== undefined) data.title = String(req.body.title || "").trim();
    if (req.body.hourlyRateCents !== undefined) data.hourlyRateCents = Number(req.body.hourlyRateCents) || 0;
    if (typeof req.body.active === "boolean") data.active = req.body.active;

    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    console.error("PATCH /api/admin/employees/:id failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to update employee" });
  }
});

adminTimeRoutes.post("/employees/:id/deactivate", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, legalName: true, active: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/employees/:id/deactivate failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to deactivate employee" });
  }
});

adminTimeRoutes.post("/employees/:id/restore", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { active: true },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/employees/:id/restore failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to restore employee" });
  }
});

adminTimeRoutes.post("/dev/employee-token", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "");
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const user = await prisma.user.findFirst({
      where: { employeeId },
      select: { id: true, role: true, employeeId: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "No user found for this employeeId (invite not accepted / user not created yet)",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET not set" });

    const token = signToken(
      {
        sub: user.id,
        role: user.role,
        employeeId: user.employeeId,
      },
      secret,
      { expiresIn: "30d" }
    );

    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to generate token" });
  }
});

// =====================================================
// LOANS
// =====================================================

adminTimeRoutes.get("/loans", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "").trim();

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;

    const loans = await prisma.employeeLoan.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
      include: {
        deductions: true,
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            active: true,
          },
        },
      },
    });

    const mapped = loans.map((l) => {
      const deductedCents = (l.deductions || []).reduce(
        (s, d) => s + Number(d.amountCents ?? 0),
        0
      );

      const computedOutstanding = Math.max(
        0,
        Number(l.principalCents ?? 0) - deductedCents
      );

      return {
        id: l.id,
        employeeId: l.employeeId,
        employee: l.employee,
        amountCents: Number(l.principalCents ?? 0),
        principalCents: Number(l.principalCents ?? 0),
        weeklyDeductionCents: Number(l.weeklyDeductionCents ?? 0),
        weeklyDeductionLocked: Boolean(l.weeklyDeductionLocked),
        deductedCents,
        outstandingCents: computedOutstanding,
        note: l.note ?? null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    });

    return res.json(employeeId ? { employeeId, loans: mapped } : { loans: mapped });
  } catch (e: any) {
    console.error("GET /api/admin/loans failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load loans" });
  }
});

adminTimeRoutes.get("/loans/outstanding", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "");
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const loans = await prisma.employeeLoan.findMany({
      where: { employeeId },
      include: { deductions: true },
      orderBy: { createdAt: "asc" },
    });

    const totalPrincipalCents = loans.reduce(
      (sum, l) => sum + Number(l.principalCents ?? 0),
      0
    );

    const totalDeductedCents = loans.reduce((sum, l) => {
      const d = (l.deductions || []).reduce((s, x) => s + Number(x.amountCents ?? 0), 0);
      return sum + d;
    }, 0);

    const outstandingCents = Math.max(0, totalPrincipalCents - totalDeductedCents);

    return res.json({
      employeeId,
      outstandingCents,
      totalPrincipalCents,
      totalDeductedCents,
      loans: loans.map((l) => ({
        id: l.id,
        principalCents: Number(l.principalCents ?? 0),
        weeklyDeductionCents: Number(l.weeklyDeductionCents ?? 0),
        weeklyDeductionLocked: Boolean(l.weeklyDeductionLocked),
        createdAt: l.createdAt,
      })),
    });
  } catch (e: any) {
    console.error("GET /api/admin/loans/outstanding failed:", e);
    return res.status(500).json({ error: "Failed to load outstanding loan" });
  }
});

adminTimeRoutes.post("/loans", async (req, res) => {
  try {
    const { employeeId, amountCents, weeklyDeductionCents, note } = req.body || {};

    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const amt = Number(amountCents);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "amountCents must be a positive integer" });
    }

    const weekly = Number(weeklyDeductionCents ?? 0);
    if (!Number.isFinite(weekly) || weekly < 0) {
      return res.status(400).json({ error: "weeklyDeductionCents must be >= 0" });
    }

    const emp = await prisma.employee.findUnique({
      where: { id: String(employeeId) },
      select: { id: true },
    });
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId: String(employeeId),
        principalCents: Math.round(amt),
        outstandingCents: Math.round(amt),
        note: note ? String(note) : null,
        weeklyDeductionCents: Math.round(weekly),
        weeklyDeductionLocked: false,
      },
      select: {
        id: true,
        employeeId: true,
        principalCents: true,
        outstandingCents: true,
        weeklyDeductionCents: true,
        weeklyDeductionLocked: true,
        note: true,
        createdAt: true,
      },
    });

    return res.json({ loan });
  } catch (e: any) {
    console.error("POST /api/admin/loans failed:", e);
    return res.status(400).json({ error: e?.message || "Failed to create loan" });
  }
});

adminTimeRoutes.patch("/loans/:loanId/weekly-deduction", async (req, res) => {
  try {
    requireLoanPin(req);

    const loanId = String(req.params.loanId || "");
    const { weeklyDeductionCents, lock } = req.body || {};

    const loan = await prisma.employeeLoan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const weekly = Number(weeklyDeductionCents);

    if (!Number.isFinite(weekly) || weekly < 0) {
      return res.status(400).json({ error: "weeklyDeductionCents must be >= 0" });
    }

    const updated = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        weeklyDeductionCents: Math.round(weekly),
        weeklyDeductionLocked:
          typeof lock === "boolean" ? lock : loan.weeklyDeductionLocked,
      },
    });

    return res.json({ loan: updated });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("PATCH /api/admin/loans/:loanId/weekly-deduction failed:", e);
    return res
      .status(status)
      .json({ error: e?.message || "Failed to update weekly deduction" });
  }
});

adminTimeRoutes.post("/loans/deduct", async (req, res) => {
  try {
    requireLoanPin(req);

    const { employeeId, amountCents } = req.body || {};
    const cents = Number(amountCents);

    if (!employeeId) return res.status(400).json({ error: "employeeId required" });
    if (!Number.isFinite(cents) || cents <= 0) {
      return res.status(400).json({ error: "amountCents must be > 0" });
    }

    const loans = await prisma.employeeLoan.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
      include: { deductions: true },
    });

    let remaining = cents;
    const created: any[] = [];

    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );

    for (const loan of loans) {
      const loanRemaining = Number(loan.outstandingCents ?? 0);
      if (loanRemaining <= 0) continue;

      const apply = Math.min(remaining, loanRemaining);

      const d = await prisma.loanDeduction.create({
        data: {
          employeeId,
          loanId: loan.id,
          amountCents: apply,
          periodStart,
          periodEnd,
          note: "Manual admin deduction",
        },
      });

      await prisma.employeeLoan.update({
        where: { id: loan.id },
        data: { outstandingCents: { decrement: apply } },
      });

      created.push(d);
      remaining -= apply;
      if (remaining <= 0) break;
    }

    if (created.length === 0) {
      return res.status(400).json({ error: "No outstanding loan to deduct from" });
    }

    return res.json({ ok: true, created, unappliedCents: remaining });
  } catch (e) {
    console.error("POST /admin/loans/deduct failed:", e);
    return res.status(500).json({ error: "Failed to deduct loan" });
  }
});

adminTimeRoutes.post("/loans/run-deductions", async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body || {};
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd required (YYYY-MM-DD)" });
    }

    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(`${periodEnd}T23:59:59.999Z`);

    const loans = await prisma.employeeLoan.findMany({
      where: {
        outstandingCents: { gt: 0 },
        weeklyDeductionCents: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });

    const created: any[] = [];

    for (const loan of loans) {
      const amount = Math.min(Number(loan.weeklyDeductionCents), Number(loan.outstandingCents));
      if (amount <= 0) continue;

      const already = await prisma.loanDeduction.findFirst({
        where: {
          loanId: loan.id,
          periodStart: start,
          periodEnd: end,
        },
        select: { id: true },
      });
      if (already) continue;

      const d = await prisma.loanDeduction.create({
        data: {
          employeeId: loan.employeeId,
          loanId: loan.id,
          amountCents: amount,
          periodStart: start,
          periodEnd: end,
        },
      });

      await prisma.employeeLoan.update({
        where: { id: loan.id },
        data: { outstandingCents: { decrement: amount } },
      });

      created.push(d);
    }

    return res.json({
      ok: true,
      periodStart,
      periodEnd,
      deductionsCreated: created.length,
      deductions: created,
    });
  } catch (e) {
    console.error("POST /api/admin/loans/run-deductions failed:", e);
    return res.status(500).json({ error: "Failed to run deductions" });
  }
});

// =====================================================
// BILLING EXPORT
// =====================================================

adminTimeRoutes.get("/billing-export", async (req, res) => {
  try {
    const { facilityId, from, to } = req.query as {
      facilityId?: string;
      from?: string;
      to?: string;
    };

    if (!facilityId) {
      return res.status(400).json({ error: "facilityId required" });
    }
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const fromDate = startOfDayUTC(from);
    const toExclusive = startOfNextDayUTC(to);

    const facility = await prisma.facility.findUnique({
      where: { id: String(facilityId) },
      select: {
        id: true,
        name: true,
      },
    });

    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        facilityId: String(facilityId),
        workDate: {
          gte: fromDate,
          lt: toExclusive,
        },
        status: {
          in: ["APPROVED", "LOCKED"],
        },
      },
      orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        employeeId: true,
        facilityId: true,
        workDate: true,
        shiftType: true,
        status: true,
        minutesWorked: true,
        breakMinutes: true,
        punchesJson: true,
        breaksJson: true,
        notes: true,
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            title: true,
            hourlyRateCents: true,
          },
        },
        breaks: {
          select: {
            minutes: true,
          },
        },
      } as any,
    });
    const facilityRates = await prisma.facilityRate.findMany({
  where: {
    facilityId: String(facilityId),
  },
  orderBy: [
    { title: "asc" },
    { effectiveFrom: "desc" },
  ],
});
    for (const e of entries) {
  const title = String((e.employee as any)?.title || "").trim();

  if (!title) {
    return res.status(400).json({
      error: `Employee "${e.employee?.legalName || e.employeeId}" has no title/designation. Billing export requires CNA/LVN/RN.`,
    });
  }

  const effectiveRate = findEffectiveFacilityRate(
    facilityRates as any[],
    title,
    new Date(e.workDate)
  );

  if (!effectiveRate) {
    return res.status(400).json({
      error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${fmtISODateOnly(e.workDate)}. Please add the rate in Admin > Facilities.`,
    });
  }
}
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Wezen Payroll";
    workbook.created = new Date();
    workbook.modified = new Date();

    const totalSheet = workbook.addWorksheet("Total Hours");
    const summarySheet = workbook.addWorksheet("Summary Flex");

    const dates = listDatesInclusive(from, to);

    const employeeMap = new Map<
      string,
      {
        employeeId: string;
        name: string;
        title: string;
        rateToBill: number;
        entries: any[];
        byDate: Map<
          string,
          {
            date: string;
            entries: any[];
            workedMinutes: number;
            breakMinutes: number;
            payableMinutes: number;
            regularMinutes: number;
            overtimeMinutes: number;
            doubleMinutes: number;
          }
        >;
        totals: {
          holidayHours: number;
          totalHours: number;
          regularHours: number;
          overtimeHours: number;
          doubleHours: number;
          holidayPay: number;
          amountToBill: number;
        };
      }
    >();

      for (const e of entries) {
  const employeeId = String(e.employeeId);
  const name = e.employee?.preferredName
    ? `${e.employee.legalName} (${e.employee.preferredName})`
    : e.employee?.legalName || "Unknown";
  const title = String((e.employee as any)?.title || "");

  const effectiveRate = findEffectiveFacilityRate(
    facilityRates as any[],
    title,
    new Date(e.workDate)
  );
  if (!effectiveRate) {
  return res.status(400).json({
      error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${fmtISODateOnly(e.workDate)}. Please add a facility billing rate before exporting.`,
  });
}

  const regRateCents = Number(effectiveRate?.regRateCents ?? 0);
  const otRateCents = Number(effectiveRate?.otRateCents ?? 0);
  const dtRateCents = Number(effectiveRate?.dtRateCents ?? 0);

  const workedMinutes = Number(e.minutesWorked || 0);
  const breakMinutes = sumBreakMinutesFromEntry(e);
  const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
  const buckets = splitDailyBuckets(payableMinutes);
  const dateISO = fmtISODateOnly(e.workDate);

  const entryBillAmount =
    (buckets.regularMinutes / 60) * (regRateCents / 100) +
    (buckets.overtimeMinutes / 60) * (otRateCents / 100) +
    (buckets.doubleMinutes / 60) * (dtRateCents / 100);

  const existing =
    employeeMap.get(employeeId) || {
      employeeId,
      name,
      title,
      rateToBill: regRateCents / 100,
      regRateCents,
      otRateCents,
      dtRateCents,
      entries: [],
      byDate: new Map(),
      totals: {
        holidayHours: 0,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        doubleHours: 0,
        holidayPay: 0,
        amountToBill: 0,
      },
    };
      existing.entries.push(e);

      const currentDay =
        existing.byDate.get(dateISO) || {
          date: dateISO,
          entries: [],
          workedMinutes: 0,
          breakMinutes: 0,
          payableMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          doubleMinutes: 0,
          billAmount: 0,  
      };

      currentDay.entries.push(e);
      currentDay.workedMinutes += workedMinutes;
      currentDay.breakMinutes += breakMinutes;
      currentDay.payableMinutes += payableMinutes;
      currentDay.regularMinutes += buckets.regularMinutes;
      currentDay.overtimeMinutes += buckets.overtimeMinutes;
      currentDay.doubleMinutes += buckets.doubleMinutes;
      currentDay.billAmount += entryBillAmount;

      existing.byDate.set(dateISO, currentDay);
      employeeMap.set(employeeId, existing);
    }

    const employees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    for (const emp of employees) {
  let regularHours = 0;
  let overtimeHours = 0;
  let doubleHours = 0;
  let amountToBill = 0;

  for (const [, day] of emp.byDate) {
    regularHours += day.regularMinutes / 60;
    overtimeHours += day.overtimeMinutes / 60;
    doubleHours += day.doubleMinutes / 60;
    amountToBill += Number(day.billAmount || 0);
  }

  const totalHours = regularHours + overtimeHours + doubleHours;
  const holidayHours = 0;
  const holidayPay = 0;

  emp.totals = {
    holidayHours: currencyExcel(holidayHours),
    totalHours: currencyExcel(totalHours),
    regularHours: currencyExcel(regularHours),
    overtimeHours: currencyExcel(overtimeHours),
    doubleHours: currencyExcel(doubleHours),
    holidayPay: currencyExcel(holidayPay),
    amountToBill: currencyExcel(amountToBill),
  };
}    

    totalSheet.columns = [
      { header: "Names", key: "name", width: 28 },
      { header: "Title", key: "title", width: 18 },
      { header: "Rate to be Billed", key: "rate", width: 18 },
      { header: "Holiday Hour", key: "holidayHours", width: 14 },
      { header: "Total hours", key: "totalHours", width: 14 },
      { header: "Regular", key: "regularHours", width: 12 },
      { header: "Overtime (9 to 12 hr)", key: "overtimeHours", width: 20 },
      { header: "Double Time", key: "doubleHours", width: 14 },
      { header: "Holiday Pay", key: "holidayPay", width: 14 },
      { header: "Amount to be billed", key: "amount", width: 18 },
    ];

    totalSheet.getRow(1).font = { bold: true };

    let totalAmount = 0;
    for (const emp of employees) {
      totalSheet.addRow({
        name: emp.name,
        title: emp.title,
        rate: emp.rateToBill,
        holidayHours: emp.totals.holidayHours,
        totalHours: emp.totals.totalHours,
        regularHours: emp.totals.regularHours,
        overtimeHours: emp.totals.overtimeHours,
        doubleHours: emp.totals.doubleHours,
        holidayPay: emp.totals.holidayPay,
        amount: emp.totals.amountToBill,
      });
      totalAmount += emp.totals.amountToBill;
    }

    const totalRow = totalSheet.addRow({
      name: "Grand Total",
      amount: currencyExcel(totalAmount),
    });
    totalRow.font = { bold: true };

    ["C", "I", "J"].forEach((col) => {
      totalSheet.getColumn(col).numFmt = "$#,##0.00";
    });
    ["D", "E", "F", "G", "H"].forEach((col) => {
      totalSheet.getColumn(col).numFmt = "0.00";
    });

    summarySheet.columns = [
      { header: "Names", key: "name", width: 28 },
      ...dates.map((d) => ({
        header: `${fmtWeekdayShort(d)} ${d.slice(5)}`,
        key: d,
        width: 12,
      })),
      { header: "Total", key: "total", width: 12 },
    ];

    summarySheet.getRow(1).font = { bold: true };

    for (const emp of employees) {
      const row: Record<string, any> = { name: emp.name };

      let total = 0;
      for (const d of dates) {
        const day = emp.byDate.get(d);
        const hours = day ? currencyExcel(day.payableMinutes / 60) : 0;
        row[d] = hours || "";
        total += hours;
      }
      row.total = currencyExcel(total);
      summarySheet.addRow(row);
    }

    for (let i = 2; i <= summarySheet.rowCount; i++) {
      for (let c = 2; c <= summarySheet.columnCount; c++) {
        summarySheet.getRow(i).getCell(c).numFmt = "0.00";
      }
    }

    for (const emp of employees) {
      const ws = workbook.addWorksheet(safeSheetName(emp.name));

      ws.columns = [
        { header: "Date", key: "date", width: 12 },
        { header: "Day", key: "day", width: 10 },
        { header: "Clock In", key: "cin1", width: 12 },
        { header: "Clock Out", key: "cout1", width: 12 },
        { header: "Clock In", key: "cin2", width: 12 },
        { header: "Clock Out", key: "cout2", width: 12 },
        { header: "Clock In", key: "cin3", width: 12 },
        { header: "Clock Out", key: "cout3", width: 12 },
        { header: "Clock In", key: "cin4", width: 12 },
        { header: "Clock Out", key: "cout4", width: 12 },
        { header: "Total Hours", key: "totalHours", width: 12 },
        { header: "Calculated", key: "calc", width: 12 },
        { header: "Regular", key: "regular", width: 12 },
        { header: "Overtime", key: "ot", width: 12 },
        { header: "Double Time", key: "dt", width: 12 },
      ];
      ws.getRow(1).font = { bold: true };

      for (const d of dates) {
        const day = emp.byDate.get(d);

        const punches = (day?.entries || []).flatMap((entry: any) =>
          Array.isArray(entry.punchesJson) ? entry.punchesJson : []
        );

        const pair = (idx: number, field: "clockIn" | "clockOut") =>
          punches[idx] ? isoToDisplayTime(punches[idx][field]) : "";

        const totalHours = day ? currencyExcel(day.payableMinutes / 60) : 0;
        const regular = day ? currencyExcel(day.regularMinutes / 60) : 0;
        const ot = day ? currencyExcel(day.overtimeMinutes / 60) : 0;
        const dt = day ? currencyExcel(day.doubleMinutes / 60) : 0;

        ws.addRow({
          date: d,
          day: fmtWeekdayShort(d),
          cin1: pair(0, "clockIn"),
          cout1: pair(0, "clockOut"),
          cin2: pair(1, "clockIn"),
          cout2: pair(1, "clockOut"),
          cin3: pair(2, "clockIn"),
          cout3: pair(2, "clockOut"),
          cin4: pair(3, "clockIn"),
          cout4: pair(3, "clockOut"),
          totalHours: totalHours || "",
          calc: totalHours || "",
          regular: regular || "",
          ot: ot || "",
          dt: dt || "",
        });
      }

      for (let i = 2; i <= ws.rowCount; i++) {
        ["K", "L", "M", "N", "O"].forEach((col) => {
          ws.getRow(i).getCell(col).numFmt = "0.00";
        });
      }
    }

    const filename = `${facility.name} Billing ${from} to ${to}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (e: any) {
    console.error("GET /api/admin/billing-export failed:", e);
    return res.status(400).json({ error: e?.message || "Failed to export billing file" });
  }
});

// =====================================================
// PAY SUMMARY
// =====================================================

adminTimeRoutes.get("/pay-summary", async (req, res) => {
  try {
    const { employeeId, from, to, status } = req.query as {
      employeeId?: string;
      from?: string;
      to?: string;
      status?: string;
    };

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }

    const where: any = {};
    if (employeeId) where.employeeId = String(employeeId);
    const statusParam = (status ? String(status) : "").trim();

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    } else if (!statusParam) {
      where.status = { in: ["APPROVED", "LOCKED"] };
    }

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDayUTC(from);
      if (to) where.workDate.lt = startOfNextDayUTC(to);
    }

    const fromDate = from ? startOfDayUTC(from) : null;
    const toExclusive = to ? startOfNextDayUTC(to) : null;

    const entries = await prisma.timeEntry.findMany({
      where,
      select: {
        id: true,
        workDate: true,
        minutesWorked: true,
        breakMinutes: true,
        breaks: { select: { minutes: true } },
        employee: { select: { hourlyRateCents: true } },
      },
      orderBy: { workDate: "asc" },
    });

    const rate = entries[0]?.employee?.hourlyRateCents ?? 0;

    const totalWorkedMinutes = entries.reduce(
      (sum, e: any) => sum + Number(e.minutesWorked ?? 0),
      0
    );

    const totalBreakMinutes = entries.reduce(
      (sum, e: any) => sum + sumBreakMinutesFromEntry(e),
      0
    );

    const payableMinutes = entries.reduce((sum, e: any) => {
      const worked = Number(e.minutesWorked ?? 0);
      const br = sumBreakMinutesFromEntry(e);
      return sum + Math.max(0, worked - br);
    }, 0);

    const grossPayCents = Math.round((payableMinutes * rate) / 60);

    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: String(employeeId),
        payrollRunId: null,
      },
      select: { amountCents: true },
    });

    const adjustmentsCents = adjustments.reduce(
      (sum, a: any) => sum + Number(a.amountCents ?? 0),
      0
    );

    const loanWhere: any = { employeeId: String(employeeId) };
    if (fromDate) loanWhere.periodStart = { gte: fromDate };
    if (toExclusive) loanWhere.periodEnd = { lt: toExclusive };

    const loanDeductions = await prisma.loanDeduction.findMany({
      where: loanWhere,
      select: {
        amountCents: true,
      },
    });

    const loanDeductionCents = loanDeductions.reduce(
      (sum, d) => sum + Number(d.amountCents ?? 0),
      0
    );

    const netPayCents = grossPayCents + adjustmentsCents - loanDeductionCents;

    return res.json({
      employeeId: String(employeeId),
      totals: {
        totalWorkedMinutes,
        totalBreakMinutes,
        payableMinutes,
        payableHours: Math.round((payableMinutes / 60) * 100) / 100,
        hourlyRateCents: rate,
        grossPayCents,
        adjustmentsCents,
        netPayCents,
        loanDeductionCents,
      },
      adjustments,
      loanDeductions,
      debug: { entryCount: entries.length },
    });
  } catch (e) {
    console.error("GET /api/admin/pay-summary failed:", e);
    return res.status(500).json({ error: "Failed to compute admin pay summary" });
  }
});

// =====================================================
// TIME ENTRIES
// =====================================================

// GET /api/admin/time-entries
adminTimeRoutes.get("/time-entries", async (req, res) => {
  try {
    const { employeeId, from, to, status, q, page = "1", pageSize = "25" } =
      req.query as Record<string, string>;

    const take = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (employeeId) where.employeeId = String(employeeId);

    const employeeIds = String(req.query.employeeIds || "").trim();
    if (!employeeId && employeeIds) {
      const ids = employeeIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length) where.employeeId = { in: ids };
    }

    if (status) where.status = String(status);

    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = startOfDayUTC(from);
      if (to) where.workDate.lt = startOfNextDayUTC(to);
    }

    if (q && q.trim()) {
      const s = q.trim();
      where.employee = {
        OR: [
          { legalName: { contains: s, mode: "insensitive" } },
          { preferredName: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
        ],
      };
    }

    const [total, entries] = await Promise.all([
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        skip,
        take,
        select: {
          id: true,
          employeeId: true,
          facilityId: true,
          workDate: true,
          status: true,
          shiftType: true,
          minutesWorked: true,
          breakMinutes: true,
          startTime: true,
          endTime: true,
          notes: true,
          punchKey: true,
          punchesJson: true,
          breaksJson: true,
          employee: {
            select: {
              id: true,
              legalName: true,
              preferredName: true,
              email: true,
              hourlyRateCents: true,
              billingRole: true,
              title: true,
            },
          },
          facility: { select: { id: true, name: true } },
          breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
        } as any,
      }),
    ]);

    const entriesWithComputed = entries.map((e: any) => {
      const breaks = Array.isArray(e.breaks) ? e.breaks : [];
      const computedBreakMinutes =
        breaks.length > 0
          ? breaks.reduce((sum: number, b: any) => sum + Number(b.minutes ?? 0), 0)
          : Number(e.breakMinutes ?? 0);

      const workedMinutes = Number(e.minutesWorked ?? 0);
      const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);

      const b = splitDailyBuckets(payableMinutes);

      const buckets = {
        regularMinutes: b.regularMinutes,
        overtimeMinutes: b.overtimeMinutes,
        doubleMinutes: b.doubleMinutes,
        regular_HHMM: fmtHHMM(b.regularMinutes),
        overtime_HHMM: fmtHHMM(b.overtimeMinutes),
        double_HHMM: fmtHHMM(b.doubleMinutes),
        regular_decimal: minutesToDecimalHours(b.regularMinutes),
        overtime_decimal: minutesToDecimalHours(b.overtimeMinutes),
        double_decimal: minutesToDecimalHours(b.doubleMinutes),
      };

      return {
        ...e,
        computedBreakMinutes,
        payableMinutes,
        totalHours_HHMM: fmtHHMM(payableMinutes),
        calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
        buckets,
      };
    });

    return res.json({
      page: pageNum,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
      entries: entriesWithComputed,
    });
  } catch (e) {
    console.error("GET /api/admin/time-entries failed:", e);
    return res.status(500).json({ error: "Failed to list time entries" });
  }
});

// GET /api/admin/time-entry/calc
adminTimeRoutes.get("/time-entry/calc", async (req, res) => {
  try {
    const workDate = String(req.query.workDate || "");
    const shiftType = String(req.query.shiftType || "");
    const punchesRaw = String(req.query.punches || "[]");
    const breaksRaw = String(req.query.breaks || "[]");

    if (!workDate || !shiftType) {
      return res.status(400).json({ error: "workDate and shiftType required" });
    }

    const punches = JSON.parse(punchesRaw);
    const breaks = JSON.parse(breaksRaw);

    const r = computeWorkedMinutes(workDate, punches);
    const computedBreaks = computeBreakRows(workDate, breaks);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
    const payableMinutes = Math.max(0, r.workedMinutes - breakMinutes);
    const buckets = splitDailyBuckets(payableMinutes);

    const warnings: string[] = [];
    if (breakMinutes > r.workedMinutes) warnings.push("Break minutes exceed worked minutes");

    return res.json({
      input: {
        workDate,
        shiftType,
        workedMinutes: r.workedMinutes,
        breakMinutes,
        payableMinutes,
      },
      display: {
        totalHours_HHMM: fmtHHMM(payableMinutes),
        calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
      },
      buckets: {
        regular_HHMM: fmtHHMM(buckets.regularMinutes),
        overtime_HHMM: fmtHHMM(buckets.overtimeMinutes),
        double_HHMM: fmtHHMM(buckets.doubleMinutes),
        regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
        overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
        double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
      },
      warnings,
    });
  } catch (e: any) {
    console.error("GET /api/admin/time-entry/calc failed:", e);
    return res.status(400).json({ error: e?.message || "Invalid input" });
  }
});

// GET /api/admin/time-entry/:id
adminTimeRoutes.get("/time-entry/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            hourlyRateCents: true,
            billingRole: true,
            title: true,
          },
        },
        facility: { select: { id: true, name: true } },
        breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
      },
    });

    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    if (!(entry as any).punchesJson && entry.startTime && entry.endTime) {
      (entry as any).punchesJson = [
        {
          clockIn: entry.startTime,
          clockOut: entry.endTime,
        },
      ];
    }

    if (!(entry as any).breaksJson && entry.breaks && entry.breaks.length > 0) {
      (entry as any).breaksJson = entry.breaks.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }));
    }

    return res.json({ entry });
  } catch (e: any) {
    console.error("GET /api/admin/time-entry/:id failed:", e);
    return res.status(500).json({ error: "Failed to load time entry" });
  }
});

// POST /api/admin/time-entry
adminTimeRoutes.post("/time-entry", async (req, res) => {
  try {
    const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};

    if (!facilityId) return res.status(400).json({ error: "facilityId required" });
    if (!employeeId || !workDate || !shiftType) {
      return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
    }
    if (!Object.values(SHIFT_TYPE).includes(shiftType)) {
      return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
    }

    await assertFacilityRateExists({
  employeeId: String(employeeId),
  facilityId: String(facilityId),
  workDate: String(workDate),
});

const emp = await prisma.employee.findUnique({
  where: { id: String(employeeId) },
});

if (!emp) return res.status(404).json({ error: "Employee not found" });
    const ws = String(workDate);

    let workedMinutes = 0;
    let startTime: Date | null = null;
    let endTime: Date | null = null;
    let shiftTypeForDb: "AM" | "PM" | "NOC" = "AM";

    if (Array.isArray(segments) && segments.length === 2) {
      const s1 = segments[0] as Segment;
      const s2 = segments[1] as Segment;

      if (!s1?.shift || !s2?.shift) {
        return res.status(400).json({ error: "segments[].shift required" });
      }
      if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
        return res.status(400).json({ error: "segments[].punches required" });
      }

      const combined = `${s1.shift}+${s2.shift}`;
      if (combined !== shiftType) {
        return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
      }

      const a = computeWorkedMinutes(ws, s1.punches);
      const b = computeWorkedMinutes(ws, s2.punches);

      validateTwoSegmentContinuity(
        { shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut },
        { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut }
      );

      workedMinutes = a.workedMinutes + b.workedMinutes;
      startTime = a.firstIn;
      endTime = b.lastOut;
      shiftTypeForDb = s1.shift;
    } else {
      if (!Array.isArray(punches) || punches.length === 0) {
        return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
      }

      const r = computeWorkedMinutes(ws, punches as Punch[]);
      workedMinutes = r.workedMinutes;
      startTime = r.firstIn;
      endTime = r.lastOut;

      if (shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM") {
        shiftTypeForDb = shiftType.split("+")[0] as "AM" | "PM" | "NOC";
      } else {
        shiftTypeForDb = shiftType as any;
      }
    }

    const computedBreaks = computeBreakRows(ws, Array.isArray(breaks) ? (breaks as BreakInput[]) : []);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);

    if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
      return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
    }

    let createdById: string | null = (req as any).user?.id ?? null;
    if (createdById) {
      const u = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
      if (!u) createdById = null;
    }

    const effectivePunches: Punch[] =
      Array.isArray(segments) && segments.length === 2
        ? ([] as Punch[]).concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
        : (punches as Punch[]);

    const punchKey = buildPunchKey(
      effectivePunches as any,
      computedBreaks.map((b) => ({
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
      }))
    );

    const workDateDb = new Date(`${ws}T00:00:00`);

    const existing = await prisma.timeEntry.findFirst({
      where: {
        employeeId: String(employeeId),
        facilityId: String(facilityId),
        workDate: workDateDb,
        shiftType: shiftTypeForDb as any,
        punchKey,
      },
      select: { id: true, status: true },
    });

    if (existing) {
      return res.status(409).json({
        error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${existing.id}, status ${existing.status}).`,
      });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: String(employeeId),
        workDate: new Date(`${ws}T00:00:00`),
        facilityId: String(facilityId),
        shiftType: shiftTypeForDb as any,
        punchKey,
        minutesWorked: workedMinutes,
        breakMinutes,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        punchesJson: effectivePunches as any,
        breaksJson: (breaks ?? []) as any,
        notes: notes ?? null,
        status: TIME_ENTRY_STATUS.DRAFT as any,
        createdById,
      } as any,
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        facilityId: true,
        shiftType: true,
        punchKey: true,
        minutesWorked: true,
        breakMinutes: true,
        startTime: true,
        endTime: true,
        punchesJson: true,
        breaksJson: true,
        notes: true,
        status: true,
        facility: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            hourlyRateCents: true,
            title: true,
          },
        },
        createdById: true,
        createdAt: true,
      } as any,
    });

    if (computedBreaks.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computedBreaks.map((b) => ({
          timeEntryId: String((entry as any).id),
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: Number(b.minutes),
        })),
      });
    }

    const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
    const buckets = splitDailyBuckets(payableMinutes);

    return res.json({
      entry,
      breaksStored: computedBreaks.length,
      preview: {
        workedMinutes,
        breakMinutes,
        payableMinutes,
        totalHours_HHMM: fmtHHMM(payableMinutes),
        calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
        buckets: {
          regularMinutes: buckets.regularMinutes,
          overtimeMinutes: buckets.overtimeMinutes,
          doubleMinutes: buckets.doubleMinutes,
          regular_HHMM: fmtHHMM(buckets.regularMinutes),
          overtime_HHMM: fmtHHMM(buckets.overtimeMinutes),
          double_HHMM: fmtHHMM(buckets.doubleMinutes),
          regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
          overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
          double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
        },
      },
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry failed:", e);

    if (e?.code === "P2002") {
      return res.status(409).json({
        error: "Duplicate entry: this employee already has the same day/facility/shift with identical punches.",
      });
    }

    return res.status(400).json({
      error: e?.message || "Failed to create time entry",
    });
  }
});

// PATCH /api/admin/time-entry/:id
adminTimeRoutes.patch("/time-entry/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const editable = await assertEditableNotLocked(id);
    if (!editable.ok) return res.status(editable.http).json({ error: editable.msg });

    const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};

    if (!facilityId) return res.status(400).json({ error: "facilityId required" });
    if (!employeeId || !workDate || !shiftType) {
      return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
    }
    if (!Object.values(SHIFT_TYPE).includes(shiftType)) {
      return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
    }

    await assertFacilityRateExists({
  employeeId: String(employeeId),
  facilityId: String(facilityId),
  workDate: String(workDate),
});

const emp = await prisma.employee.findUnique({
  where: { id: String(employeeId) },
});
if (!emp) return res.status(404).json({ error: "Employee not found" });
    const ws = String(workDate);

    let workedMinutes = 0;
    let startTime: Date | null = null;
    let endTime: Date | null = null;
    let shiftTypeForDb: "AM" | "PM" | "NOC" = "AM";

    if (Array.isArray(segments) && segments.length === 2) {
      const s1 = segments[0] as Segment;
      const s2 = segments[1] as Segment;

      if (!s1?.shift || !s2?.shift) {
        return res.status(400).json({ error: "segments[].shift required" });
      }
      if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
        return res.status(400).json({ error: "segments[].punches required" });
      }

      const combined = `${s1.shift}+${s2.shift}`;
      if (combined !== shiftType) {
        return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
      }

      const a = computeWorkedMinutes(ws, s1.punches);
      const b = computeWorkedMinutes(ws, s2.punches);

      validateTwoSegmentContinuity(
        { shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut },
        { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut }
      );

      workedMinutes = a.workedMinutes + b.workedMinutes;
      startTime = a.firstIn;
      endTime = b.lastOut;
      shiftTypeForDb = s1.shift;
    } else {
      if (!Array.isArray(punches) || punches.length === 0) {
        return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
      }

      const r = computeWorkedMinutes(ws, punches as Punch[]);
      workedMinutes = r.workedMinutes;
      startTime = r.firstIn;
      endTime = r.lastOut;

      if (shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM") {
        shiftTypeForDb = shiftType.split("+")[0] as "AM" | "PM" | "NOC";
      } else {
        shiftTypeForDb = shiftType as any;
      }
    }

    const computedBreaks = computeBreakRows(ws, Array.isArray(breaks) ? (breaks as BreakInput[]) : []);
    const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);

    if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
      return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
    }

    const effectivePunches: Punch[] =
      Array.isArray(segments) && segments.length === 2
        ? ([] as Punch[]).concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
        : (punches as Punch[]);

    const punchKey = buildPunchKey(
      effectivePunches as any,
      computedBreaks.map((b) => ({
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
      }))
    );

    const workDateDb = new Date(`${ws}T00:00:00`);

    const dup = await prisma.timeEntry.findFirst({
      where: {
        id: { not: id },
        employeeId: String(employeeId),
        facilityId: String(facilityId),
        workDate: workDateDb,
        shiftType: shiftTypeForDb as any,
        punchKey,
      },
      select: { id: true, status: true },
    });

    if (dup) {
      return res.status(409).json({
        error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${dup.id}, status ${dup.status}).`,
      });
    }

    const data: any = {
      employeeId: String(employeeId),
      facilityId: String(facilityId),
      workDate: workDateDb,
      shiftType: shiftTypeForDb as any,
      punchKey,
      minutesWorked: workedMinutes,
      breakMinutes,
      startTime,
      endTime,
      notes: notes ?? null,
      punchesJson: effectivePunches as any,
      breaksJson: computedBreaks.map((b) => ({
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
      })) as any,
    };

    if (req.body.status) {
      data.status = String(req.body.status);
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data,
      select: {
        id: true,
        employeeId: true,
        facilityId: true,
        workDate: true,
        shiftType: true,
        status: true,
        minutesWorked: true,
        breakMinutes: true,
        startTime: true,
        endTime: true,
        notes: true,
        punchKey: true,
        punchesJson: true,
        breaksJson: true,
        facility: { select: { id: true, name: true } },
        employee: { select: { id: true, legalName: true, preferredName: true, email: true } },
      } as any,
    });

    await prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });
    if (computedBreaks.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computedBreaks.map((b) => ({
          timeEntryId: id,
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: b.minutes,
        })),
      });
    }

    return res.json({ entry: updated, breaksStored: computedBreaks.length });
  } catch (e: any) {
    console.error("PATCH /api/admin/time-entry/:id failed:", e);
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "Duplicate entry constraint hit." });
    }
    return res.status(e?.status || 400).json({ error: e?.message || "Failed to update time entry" });
  }
});

// POST /api/admin/time-entry/:id/breaks
adminTimeRoutes.post("/time-entry/:id/breaks", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const editable = await assertEditableNotLocked(id);
    if (!editable.ok) return res.status(editable.http).json({ error: editable.msg });

    const { workDate, breaks } = req.body || {};
    if (!workDate) return res.status(400).json({ error: "workDate required" });

    const ws = String(workDate);
    const computed = computeBreakRows(ws, Array.isArray(breaks) ? breaks : []);

    await prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });

    if (computed.length > 0) {
      await prisma.timeEntryBreak.createMany({
        data: computed.map((b) => ({
          timeEntryId: id,
          startTime: b.startTime,
          endTime: b.endTime,
          minutes: b.minutes,
        })),
      });
    }

    const breakMinutes = computed.reduce((sum, b) => sum + b.minutes, 0);
    await prisma.timeEntry.update({
      where: { id },
      data: { breakMinutes },
    });

    return res.json({ ok: true, breakMinutes, breaksStored: computed.length });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/:id/breaks failed:", e);
    return res.status(e?.status || 400).json({ error: e?.message || "Failed to update breaks" });
  }
});

// POST /api/admin/time-entry/approve-week
adminTimeRoutes.post("/time-entry/approve-week", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const startDate = String(req.body.startDate || "").trim();
    const endDate = String(req.body.endDate || "").trim();

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(startDate);
    const toExclusive = startOfNextDayUTC(endDate);

    const result = await prisma.timeEntry.updateMany({
      where: {
        employeeId,
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: "DRAFT",
      },
      data: {
        status: "APPROVED",
      },
    });

    return res.json({
      ok: true,
      employeeId,
      startDate,
      endDate,
      approvedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/approve-week failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve week" });
  }
});

// POST /api/admin/time-entry/lock-week
adminTimeRoutes.post("/time-entry/lock-week", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const startDate = String(req.body.startDate || "").trim();
    const endDate = String(req.body.endDate || "").trim();

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(startDate);
    const toExclusive = startOfNextDayUTC(endDate);

    const result = await prisma.timeEntry.updateMany({
      where: {
        employeeId,
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: {
          in: ["DRAFT", "APPROVED"],
        },
      },
      data: {
        status: "LOCKED",
      },
    });

    return res.json({
      ok: true,
      employeeId,
      startDate,
      endDate,
      lockedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entry/lock-week failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to lock week" });
  }
});

// POST /api/admin/time-entries/approve
adminTimeRoutes.post("/time-entries/approve", async (req, res) => {
  try {
    const { from, to } = req.body || {};
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const fromDt = startOfDayUTC(String(from));
    const toExclusive = startOfNextDayUTC(String(to));

    const r = await prisma.timeEntry.updateMany({
      where: {
        status: "DRAFT",
        workDate: { gte: fromDt, lt: toExclusive },
      },
      data: { status: "APPROVED" },
    });

    return res.json({ approvedCount: r.count });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/approve failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve entries" });
  }
});

// POST /api/admin/time-entries/approve-selected
adminTimeRoutes.post("/time-entries/approve-selected", async (req, res) => {
  try {
    const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];

    if (entryIds.length === 0) {
      return res.status(400).json({ error: "entryIds required" });
    }

    const result = await prisma.timeEntry.updateMany({
      where: {
        id: { in: entryIds },
        status: "DRAFT",
      },
      data: {
        status: "APPROVED",
      },
    });

    return res.json({
      ok: true,
      approvedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/approve-selected failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to approve selected entries" });
  }
});

// POST /api/admin/time-entries/lock-selected
adminTimeRoutes.post("/time-entries/lock-selected", async (req, res) => {
  try {
    const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];

    if (entryIds.length === 0) {
      return res.status(400).json({ error: "entryIds required" });
    }

    const result = await prisma.timeEntry.updateMany({
      where: {
        id: { in: entryIds },
        status: { in: ["DRAFT", "APPROVED"] },
      },
      data: {
        status: "LOCKED",
      },
    });

    return res.json({
      ok: true,
      lockedCount: result.count,
    });
  } catch (e: any) {
    console.error("POST /api/admin/time-entries/lock-selected failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to lock selected entries" });
  }
});

// =====================================================
// PAYROLL ADJUSTMENTS
// =====================================================

// GET /api/admin/payroll-adjustments
adminTimeRoutes.get("/payroll-adjustments", async (req, res) => {
  try {
    const adjustments = await prisma.payrollAdjustment.findMany({
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
          },
        },
        payrollRun: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ adjustments });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-adjustments failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll adjustments" });
  }
});

// POST /api/admin/payroll-adjustments
adminTimeRoutes.post("/payroll-adjustments", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const reason = String(req.body.reason || "").trim();
    const amountCents = Number(req.body.amountCents);

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!reason) {
      return res.status(400).json({ error: "reason required" });
    }
    if (!Number.isFinite(amountCents) || amountCents === 0) {
      return res.status(400).json({ error: "amountCents must be a non-zero number" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId,
        reason,
        amountCents,
        payrollRunId: null,
      },
    });

    return res.json({ ok: true, adjustment });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-adjustments failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to create payroll adjustment" });
  }
});

// =====================================================
// PAYROLL RUNS
// =====================================================

// GET /api/admin/payroll-runs
adminTimeRoutes.get("/payroll-runs", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.periodStart = {};
      if (from) where.periodStart.gte = startOfDayUTC(from);
      if (to) where.periodStart.lt = startOfNextDayUTC(to);
    }

    const runs = await prisma.payrollRun.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        employees: {
          select: {
            id: true,
            employeeId: true,
            grossPayCents: true,
            adjustmentsCents: true,
            loanDeductionCents: true,
            netPayCents: true,
          },
        },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    });

    const items = runs.map((run) => {
      const employeeCount = run.employees.length;

      const grossPayCents = run.employees.reduce(
        (sum, e) => sum + Number(e.grossPayCents || 0),
        0
      );
      const adjustmentsCents = run.employees.reduce(
        (sum, e) => sum + Number(e.adjustmentsCents || 0),
        0
      );
      const loanDeductionCents = run.employees.reduce(
        (sum, e) => sum + Number(e.loanDeductionCents || 0),
        0
      );
      const netPayCents = run.employees.reduce(
        (sum, e) => sum + Number(e.netPayCents || 0),
        0
      );

      return {
        id: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        notes: run.notes,
        finalizedAt: run.finalizedAt,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
        employeeCount,
        grossPayCents,
        adjustmentsCents,
        loanDeductionCents,
        netPayCents,
      };
    });

    return res.json({ payrollRuns: items });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to list payroll runs" });
  }
});

// GET /api/admin/payroll-runs/:id
adminTimeRoutes.get("/payroll-runs/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        employees: {
          include: {
            employee: {
              select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                payrollAdjustments: {
                  orderBy: { createdAt: "desc" },
                  select: {
                    id: true,
                    amountCents: true,
                    reason: true,
                    createdAt: true,
                    payrollRunId: true,
                  },
                },
              },
            },
          },
          orderBy: {
            employeeId: "asc",
          },
        },
        entrySnapshots: {
          include: {
            employee: {
              select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
              },
            },
            corrections: {
              select: {
                id: true,
                reason: true,
                adjustmentAmountCents: true,
                createdAt: true,
                createdById: true,
                payrollAdjustmentId: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            workDate: "asc",
          },
        },
      },
    });

    if (!payrollRun) {
      return res.status(404).json({ error: "Payroll run not found" });
    }

    return res.json({ payrollRun });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs/:id failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll run" });
  }
});

// POST /api/admin/payroll-runs/finalize
adminTimeRoutes.post("/payroll-runs/finalize", async (req, res) => {
  try {
    const periodStart = String(req.body.periodStart || "").trim();
    const periodEnd = String(req.body.periodEnd || "").trim();
    const notes = req.body.notes == null ? null : String(req.body.notes);

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd required (YYYY-MM-DD)" });
    }

    const fromDt = startOfDayUTC(periodStart);
    const toExclusive = startOfNextDayUTC(periodEnd);

    const existing = await prisma.payrollRun.findFirst({
      where: {
        periodStart: fromDt,
        periodEnd: startOfDayUTC(periodEnd),
        status: "FINALIZED",
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: "A finalized payroll run already exists for this pay period" });
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        workDate: {
          gte: fromDt,
          lt: toExclusive,
        },
        status: {
          in: ["APPROVED", "LOCKED"],
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
            hourlyRateCents: true,
            title: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
        breaks: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            minutes: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
    });

    if (entries.length === 0) {
      return res.status(400).json({ error: "No approved/locked time entries found for this pay period" });
    }

    const facilityIds = Array.from(
  new Set(entries.map((e) => String(e.facilityId || "")).filter(Boolean))
);

const facilityRates = await prisma.facilityRate.findMany({
  where: {
    facilityId: { in: facilityIds },
  },
  orderBy: [
    { facilityId: "asc" },
    { title: "asc" },
    { effectiveFrom: "desc" },
  ],
});   
    
    const validationErrors: string[] = [];

for (const e of entries) {
  const employeeName =
    e.employee?.preferredName
      ? `${e.employee.legalName} (${e.employee.preferredName})`
      : e.employee?.legalName || e.employeeId;

  const title = String((e.employee as any)?.title || "").trim();
  if (!title) {
    validationErrors.push(`Employee "${employeeName}" has no designation/title.`);
    continue;
  }

  const facId = String(e.facilityId || "").trim();
  if (!facId) {
    validationErrors.push(
      `Employee "${employeeName}" has a time entry on ${fmtISODateOnly(e.workDate)} with no facility.`
    );
    continue;
  }

  const facilityName = e.facility?.name || facId;

  const applicableRates = facilityRates.filter(
    (r) => String(r.facilityId || "") === facId
  );

  const effectiveRate = findEffectiveFacilityRate(
    applicableRates as any[],
    title,
    new Date(e.workDate)
  );

  if (!effectiveRate) {
    validationErrors.push(
      `Missing billing rate for facility "${facilityName}", title "${title}", work date ${fmtISODateOnly(e.workDate)}.`
    );
  }
}

if (validationErrors.length > 0) {
  return res.status(400).json({
    error: "Payroll cannot be finalized until all facility billing setup is complete.",
    details: validationErrors,
  });
}

    const createdById = (req as any).user?.id || null;

    const result = await prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          periodStart: fromDt,
          periodEnd: startOfDayUTC(periodEnd),
          status: "FINALIZED",
          notes,
          createdById,
          finalizedAt: new Date(),
        },
      });

      const byEmployee = new Map<
        string,
        {
          employeeId: string;
          regularMinutes: number;
          overtimeMinutes: number;
          doubleMinutes: number;
          breakMinutes: number;
          payableMinutes: number;
          regularPayCents: number;
          overtimePayCents: number;
          doublePayCents: number;
          grossPayCents: number;
        }
      >();

      for (const e of entries) {
        const breaks = Array.isArray(e.breaks) ? e.breaks : [];
        const computedBreakMinutes =
          breaks.length > 0
            ? breaks.reduce((sum, b) => sum + Number(b.minutes || 0), 0)
            : Number((e as any).breakMinutes || 0);

        const workedMinutes = Number(e.minutesWorked || 0);
        const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);

        const buckets = splitDailyBuckets(payableMinutes);
        const rateCents = Number(e.employee?.hourlyRateCents || 0);

        const regularPayCents = Math.round((buckets.regularMinutes * rateCents) / 60);
        const overtimePayCents = Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60);
        const doublePayCents = Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
        const grossPayCents = regularPayCents + overtimePayCents + doublePayCents;

        const current =
          byEmployee.get(e.employeeId) || {
            employeeId: e.employeeId,
            regularMinutes: 0,
            overtimeMinutes: 0,
            doubleMinutes: 0,
            breakMinutes: 0,
            payableMinutes: 0,
            regularPayCents: 0,
            overtimePayCents: 0,
            doublePayCents: 0,
            grossPayCents: 0,
          };

        current.regularMinutes += buckets.regularMinutes;
        current.overtimeMinutes += buckets.overtimeMinutes;
        current.doubleMinutes += buckets.doubleMinutes;
        current.breakMinutes += computedBreakMinutes;
        current.payableMinutes += payableMinutes;
        current.regularPayCents += regularPayCents;
        current.overtimePayCents += overtimePayCents;
        current.doublePayCents += doublePayCents;
        current.grossPayCents += grossPayCents;

        byEmployee.set(e.employeeId, current);

        await tx.payrollRunEntrySnapshot.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: e.employeeId,
            timeEntryId: e.id,
            workDate: e.workDate,
            status: String(e.status),
            snapshotJson: {
              timeEntryId: e.id,
              employeeId: e.employeeId,
              employeeName: e.employee?.legalName ?? null,
              facilityId: e.facilityId,
              facilityName: e.facility?.name ?? null,
              workDate: e.workDate,
              shiftType: e.shiftType,
              status: e.status,
              punchesJson: (e as any).punchesJson ?? null,
              breaksJson: (e as any).breaksJson ?? null,
              breakRows: breaks,
              workedMinutes,
              breakMinutes: computedBreakMinutes,
              payableMinutes,
              regularMinutes: buckets.regularMinutes,
              overtimeMinutes: buckets.overtimeMinutes,
              doubleMinutes: buckets.doubleMinutes,
              hourlyRateCents: rateCents,
              regularPayCents,
              overtimePayCents,
              doublePayCents,
              grossPayCents,
              notes: e.notes ?? null,
            } as any,
          },
        });
      }

      for (const [, totals] of byEmployee) {
        const adjustments = await tx.payrollAdjustment.findMany({
          where: {
            employeeId: totals.employeeId,
            payrollRunId: null,
          },
          select: { id: true, amountCents: true },
        });

        const loanDeductions = await tx.loanDeduction.findMany({
          where: {
            employeeId: totals.employeeId,
            periodStart: { gte: fromDt },
            periodEnd: { lt: toExclusive },
          },
          select: { amountCents: true },
        });

        const adjustmentsCents = adjustments.reduce((s, a) => s + Number(a.amountCents || 0), 0);
        const loanDeductionCents = loanDeductions.reduce((s, d) => s + Number(d.amountCents || 0), 0);
        const netPayCents = totals.grossPayCents + adjustmentsCents - loanDeductionCents;

        await tx.payrollRunEmployee.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: totals.employeeId,
            regularMinutes: totals.regularMinutes,
            overtimeMinutes: totals.overtimeMinutes,
            doubleMinutes: totals.doubleMinutes,
            breakMinutes: totals.breakMinutes,
            payableMinutes: totals.payableMinutes,
            regularPayCents: totals.regularPayCents,
            overtimePayCents: totals.overtimePayCents,
            doublePayCents: totals.doublePayCents,
            grossPayCents: totals.grossPayCents,
            adjustmentsCents,
            loanDeductionCents,
            netPayCents,
            snapshotVersion: 1,
          },
        });

        if (adjustments.length > 0) {
          await tx.payrollAdjustment.updateMany({
            where: {
              id: { in: adjustments.map((a) => a.id) },
            },
            data: {
              payrollRunId: payrollRun.id,
            },
          });
        }
      }

      return {
        payrollRunId: payrollRun.id,
        employeeCount: byEmployee.size,
        snapshotCount: entries.length,
      };
    });

    return res.json({
      ok: true,
      periodStart,
      periodEnd,
      payrollRunId: result.payrollRunId,
      employeeCount: result.employeeCount,
      snapshotCount: result.snapshotCount,
    });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-runs/finalize failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to finalize payroll run" });
  }
});

// GET /api/admin/payroll-runs/:runId/snapshots/:snapshotId
adminTimeRoutes.get("/payroll-runs/:runId/snapshots/:snapshotId", async (req, res) => {
  try {
    const runId = String(req.params.runId || "");
    const snapshotId = String(req.params.snapshotId || "");

    const snapshot = await prisma.payrollRunEntrySnapshot.findFirst({
      where: {
        id: snapshotId,
        payrollRunId: runId,
      },
      include: {
        employee: {
          select: {
            id: true,
            legalName: true,
            preferredName: true,
            email: true,
          },
        },
        payrollRun: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    return res.json({ snapshot });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-runs/:runId/snapshots/:snapshotId failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to load payroll snapshot" });
  }
});

// =====================================================
// PAYROLL CORRECTIONS
// =====================================================

// GET /api/admin/payroll-correction/calc
adminTimeRoutes.get("/payroll-correction/calc", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "").trim();
    const workDate = String(req.query.workDate || "").trim();
    const shiftType = String(req.query.shiftType || "AM").trim();
    const punchesRaw = String(req.query.punches || "[]");
    const breaksRaw = String(req.query.breaks || "[]");

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }
    if (!workDate) {
      return res.status(400).json({ error: "workDate required" });
    }

    const punches = JSON.parse(punchesRaw);
    const breaks = JSON.parse(breaksRaw);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        hourlyRateCents: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const calc = calculateTimeEntryTotals({
      workDate,
      shiftType,
      punches,
      breaks,
      hourlyRateCents: employee.hourlyRateCents,
    });

    return res.json({
      input: {
        workDate,
        shiftType,
        workedMinutes: calc.workedMinutes,
        breakMinutes: calc.breakMinutes,
        payableMinutes: calc.payableMinutes,
      },
      buckets: {
        regularMinutes: calc.regularMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        doubleMinutes: calc.doubleMinutes,
        regular_HHMM: fmtHHMM(calc.regularMinutes),
        overtime_HHMM: fmtHHMM(calc.overtimeMinutes),
        double_HHMM: fmtHHMM(calc.doubleMinutes),
      },
      pay: {
        hourlyRateCents: employee.hourlyRateCents,
        regularPayCents: calc.regularPayCents,
        overtimePayCents: calc.overtimePayCents,
        doublePayCents: calc.doublePayCents,
        grossPayCents: calc.grossPayCents,
      },
      display: {
        payableHours_HHMM: fmtHHMM(calc.payableMinutes),
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/payroll-correction/calc failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to calculate payroll correction" });
  }
});

// POST /api/admin/payroll-corrections
adminTimeRoutes.post("/payroll-corrections", async (req, res) => {
  try {
    const {
      payrollRunId,
      payrollRunSnapshotId,
      employeeId,
      workDate,
      reason,
      originalSnapshotJson,
      correctedInputJson,
      correctedResultJson,
      adjustmentAmountCents,
    } = req.body || {};

    const runId = String(payrollRunId || "").trim();
    const snapshotId = String(payrollRunSnapshotId || "").trim();
    const empId = String(employeeId || "").trim();
    const workDateStr = String(workDate || "").trim();
    const reasonStr = String(reason || "").trim();
    const deltaCents = Number(adjustmentAmountCents);

    if (!runId) return res.status(400).json({ error: "payrollRunId required" });
    if (!snapshotId) return res.status(400).json({ error: "payrollRunSnapshotId required" });
    if (!empId) return res.status(400).json({ error: "employeeId required" });
    if (!workDateStr) return res.status(400).json({ error: "workDate required" });
    if (!reasonStr) return res.status(400).json({ error: "reason required" });
    if (!Number.isFinite(deltaCents) || deltaCents === 0) {
      return res.status(400).json({ error: "adjustmentAmountCents must be a non-zero number" });
    }

    const snapshot = await prisma.payrollRunEntrySnapshot.findFirst({
      where: {
        id: snapshotId,
        payrollRunId: runId,
        employeeId: empId,
      },
      select: {
        id: true,
        payrollRunId: true,
        employeeId: true,
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Payroll snapshot not found" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const createdById = (req as any)?.user?.sub ? String((req as any).user.sub) : null;

    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.payrollAdjustment.create({
        data: {
          employeeId: empId,
          amountCents: Math.round(deltaCents),
          reason: reasonStr,
          payrollRunId: null,
        },
      });

      const correction = await tx.payrollCorrection.create({
        data: {
          payrollRunId: runId,
          payrollRunSnapshotId: snapshotId,
          employeeId: empId,
          workDate: new Date(`${workDateStr}T00:00:00.000Z`),
          reason: reasonStr,
          originalSnapshotJson,
          correctedInputJson,
          correctedResultJson,
          adjustmentAmountCents: Math.round(deltaCents),
          payrollAdjustmentId: adjustment.id,
          createdById,
        },
      });

      return { adjustment, correction };
    });

    return res.json({
      ok: true,
      adjustment: result.adjustment,
      correction: result.correction,
    });
  } catch (e: any) {
    console.error("POST /api/admin/payroll-corrections failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to create payroll correction" });
  }
});

// =====================================================
// PIN / ADMIN UTILS
// =====================================================

// POST /api/admin/verify-pin
adminTimeRoutes.post("/verify-pin", async (req, res) => {
  try {
    requireAdminPinFromBody(req);
    return res.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/verify-pin failed:", e);
    return res.status(status).json({ error: e?.message || "PIN verification failed" });
  }
});

// POST /api/admin/dev/employee-token
adminTimeRoutes.post("/dev/employee-token", async (req, res) => {
  try {
    const employeeId = String(req.body.employeeId || "");
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const user = await prisma.user.findFirst({
      where: { employeeId },
      select: { id: true, role: true, employeeId: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "No user found for this employeeId (invite not accepted / user not created yet)",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET not set" });

    const token = signToken(
      {
        sub: user.id,
        role: user.role,
        employeeId: user.employeeId,
      },
      secret,
      { expiresIn: "30d" }
    );

    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to generate token" });
  }
});

// =====================================================
// EMPLOYEES
// =====================================================

// GET /api/admin/employees
adminTimeRoutes.get("/employees", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        billingRole: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
        ssnLast4: true,
        createdAt: true,
      },
    });

    return res.json({ employees });
  } catch (e) {
    console.error("GET /api/admin/employees failed:", e);
    return res.status(500).json({ error: "Failed to load employees" });
  }
});

// POST /api/admin/employees
adminTimeRoutes.post("/employees", async (req, res) => {
  try {
    const { legalName, preferredName, hourlyRateCents, title, billingRole } = req.body || {};
    const email = String(req.body.email || "").trim().toLowerCase();

    const ssnLast4Raw = req.body.ssnLast4 == null ? "" : String(req.body.ssnLast4);
    const zipRaw = req.body.zip == null ? "" : String(req.body.zip);

    const ssnLast4 = ssnLast4Raw.replace(/\D/g, "");
    const zip = zipRaw.replace(/\D/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (ssnLast4 && !/^\d{4}$/.test(ssnLast4)) {
      return res.status(400).json({ error: "SSN last 4 must be exactly 4 digits" });
    }

    if (zip && !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "Zip must be exactly 5 digits" });
    }

    const rawTitle = String(title ?? "").trim().toUpperCase();
    if (!legalName || !email || hourlyRateCents == null || !rawTitle) {
      return res.status(400).json({ error: "legalName, email, hourlyRateCents, title required" });
    }

    if (!["CNA", "LVN", "RN"].includes(rawTitle)) {
      return res.status(400).json({ error: "title must be CNA|LVN|RN" });
    }

    const employee = await prisma.employee.create({
      data: {
        legalName,
        preferredName: preferredName ?? null,
        email,
        hourlyRateCents: Number(hourlyRateCents),
        active: true,
        title: rawTitle as any,
        billingRole: billingRole ? String(billingRole) : rawTitle,
        addressLine1: req.body.addressLine1 || null,
        addressLine2: req.body.addressLine2 || null,
        city: req.body.city || null,
        state: req.body.stateProv || req.body.state || null,
        zip: zip || null,
        ssnLast4: ssnLast4 || null,
      },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        billingRole: true,
      },
    });

    return res.json({ employee });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return res.status(409).json({
        error: "Employee already exists (duplicate email or unique field).",
      });
    }

    console.error("POST /api/admin/employees failed:", e);
    return res.status(500).json({ error: "Failed to create employee" });
  }
});

// PATCH /api/admin/employees/:id
adminTimeRoutes.patch("/employees/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const data: any = {};

    if (req.body.legalName !== undefined) data.legalName = String(req.body.legalName || "").trim();
    if (req.body.preferredName !== undefined) data.preferredName = String(req.body.preferredName || "").trim() || null;
    if (req.body.email !== undefined) data.email = String(req.body.email || "").trim().toLowerCase();
    if (req.body.title !== undefined) data.title = String(req.body.title || "").trim().toUpperCase();
    if (req.body.billingRole !== undefined) data.billingRole = String(req.body.billingRole || "").trim() || null;
    if (req.body.hourlyRateCents !== undefined) data.hourlyRateCents = Number(req.body.hourlyRateCents) || 0;
    if (typeof req.body.active === "boolean") data.active = req.body.active;

    if (req.body.addressLine1 !== undefined) data.addressLine1 = req.body.addressLine1 || null;
    if (req.body.addressLine2 !== undefined) data.addressLine2 = req.body.addressLine2 || null;
    if (req.body.city !== undefined) data.city = req.body.city || null;
    if (req.body.state !== undefined) data.state = req.body.state || null;
    if (req.body.zip !== undefined) data.zip = req.body.zip ? String(req.body.zip).replace(/\D/g, "") : null;
    if (req.body.ssnLast4 !== undefined) data.ssnLast4 = req.body.ssnLast4 ? String(req.body.ssnLast4).replace(/\D/g, "") : null;

    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        billingRole: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
        ssnLast4: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    console.error("PATCH /api/admin/employees/:id failed:", e);
    return res.status(500).json({ error: e?.message || "Failed to update employee" });
  }
});

// POST /api/admin/employees/:id/deactivate
adminTimeRoutes.post("/employees/:id/deactivate", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, legalName: true, active: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        billingRole: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/employees/:id/deactivate failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to deactivate employee" });
  }
});

// POST /api/admin/employees/:id/restore
adminTimeRoutes.post("/employees/:id/restore", async (req, res) => {
  try {
    requireFacilityPin(req);

    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { active: true },
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        hourlyRateCents: true,
        active: true,
        title: true,
        billingRole: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, employee });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error("POST /api/admin/employees/:id/restore failed:", e);
    return res.status(status).json({ error: e?.message || "Failed to restore employee" });
  }
});

// =====================================================
// FACILITIES
// =====================================================

// GET /api/admin/facilities
adminTimeRoutes.get("/facilities", async (req, res) => {
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

// GET /api/admin/facilities/:facilityId/rate-check?employeeId=...&workDate=YYYY-MM-DD
adminTimeRoutes.get("/facilities/:facilityId/rate-check", async (req, res) => {
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

// POST /api/admin/facilities
adminTimeRoutes.post("/facilities", async (req, res) => {
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

// PATCH /api/admin/facilities/:id
adminTimeRoutes.patch("/facilities/:id", async (req, res) => {
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

// POST /api/admin/facilities/:id/archive
adminTimeRoutes.post("/facilities/:id/archive", async (req, res) => {
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

// POST /api/admin/facilities/:id/restore
adminTimeRoutes.post("/facilities/:id/restore", async (req, res) => {
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

// POST /api/admin/facilities/:facilityId/rates
adminTimeRoutes.post("/facilities/:facilityId/rates", async (req, res) => {
  try {
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

export default adminTimeRoutes;
