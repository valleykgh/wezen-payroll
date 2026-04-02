import { prisma } from "../../prisma";

export const TIME_ENTRY_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;

export const SHIFT_TYPE = {
  AM: "AM",
  PM: "PM",
  NOC: "NOC",
  AM_PM: "AM+PM",
  PM_NOC: "PM+NOC",
  NOC_AM: "NOC+AM",
} as const;

export const MAX_GAP_MINUTES = 120;

export type Punch = {
  clockIn: string;
  clockOut: string;
};

export type BreakInput = {
  startTime: string;
  endTime: string;
};

export type Segment = {
  shift: "AM" | "PM" | "NOC";
  punches: Punch[];
};

export function requireAdminPinFromBody(req: any) {
  const providedPin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
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

export function hasValidAdminPin(req: any): boolean {
  const providedPin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
  const expectedPin = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();

  return !!expectedPin && !!providedPin && providedPin === expectedPin;
}

export function requireFacilityPin(req: any) {
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

export function requireLoanPin(req: any) {
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

export function startOfDayUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function startOfNextDayUTC(iso: string) {
  const d = startOfDayUTC(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function listDatesInclusive(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }

  return out;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function fmtHHMM(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

export function minutesToDecimalHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

export function fmtISODateOnly(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function fmtWeekdayShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function safeSheetName(name: string) {
  return String(name || "Sheet")
    .replace(/[\\/*?:[\]]/g, "")
    .slice(0, 31);
}

export function addSheetTitle(ws: any, title: string, subtitle?: string, mergeToCol = 10) {
  ws.insertRow(1, [title]);
  ws.mergeCells(1, 1, 1, mergeToCol);
  ws.getRow(1).font = { bold: true, size: 15 };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "left" };

  if (subtitle) {
    ws.insertRow(2, [subtitle]);
    ws.mergeCells(2, 1, 2, mergeToCol);
    ws.getRow(2).font = { italic: true, size: 11, color: { argb: "FF6B7280" } };
    ws.getRow(2).alignment = { vertical: "middle", horizontal: "left" };
    ws.insertRow(3, []);
    return 4;
  }

  ws.insertRow(2, []);
  return 3;
}

export function currencyExcel(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

export function autoSizeColumns(ws: any, minWidth = 10, maxWidth = 40) {
  ws.columns.forEach((column: any) => {
    let maxLength = minWidth;

    column.eachCell?.({ includeEmpty: true }, (cell: any) => {
      const raw = cell?.value;
      const text =
        raw == null
          ? ""
          : typeof raw === "object" && raw.richText
          ? raw.richText.map((x: any) => x.text).join("")
          : String(raw);

      maxLength = Math.max(maxLength, text.length + 2);
    });

    column.width = Math.min(maxWidth, Math.max(minWidth, maxLength));
  });
}

export function isoToDisplayTime(v?: string | null): string {
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

export function parseTimeOnDate(workDateISO: string, timeStr: string): Date {
  const s = (timeStr || "").trim();
  if (!s) throw new Error("Invalid time");

  if (s.includes("T")) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const base = new Date(`${workDateISO}T00:00:00`);
  if (Number.isNaN(base.getTime())) throw new Error("Invalid workDate");

  const normalized = s.replace(/\./g, "").replace(/\s+/g, " ").trim().toUpperCase();

  const m24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const hh = Number(m24[1]);
    const mm = Number(m24[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error("Invalid time");
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  const m12 = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m12) {
    let hh = Number(m12[1]);
    const mm = Number(m12[2] ?? "00");
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

  const bareHour = normalized.match(/^(\d{1,2})$/);
  if (bareHour) {
    const hh = Number(bareHour[1]);
    if (hh < 0 || hh > 23) throw new Error("Invalid time");
    const d = new Date(base);
    d.setHours(hh, 0, 0, 0);
    return d;
  }

  const compact = normalized.match(/^(\d{3,4})$/);
  if (compact) {
    const digits = compact[1];
    const hh = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const mm = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error("Invalid time");
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  throw new Error(`Unsupported time format: ${timeStr}`);
}
export function splitDailyBuckets(payableMinutes: number) {
  const m = Math.max(0, Math.floor(payableMinutes));
  const regularCap = 8 * 60;
  const otCap = 12 * 60;

  const regularMinutes = Math.min(m, regularCap);
  const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
  const doubleMinutes = Math.max(0, m - otCap);

  return { regularMinutes, overtimeMinutes, doubleMinutes };
}

export const HOLIDAY_DATES = new Set<string>([
  // Add company-observed holiday dates here in YYYY-MM-DD format
  // Example:
   "2026-01-01",
   "2026-07-04",
   "2026-05-25",
   "2026-09-07",
   "2026-11-26",
   "2026-12-25",
]);

export function dateOnlyUTC(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export function isHolidayDate(workDate: string | Date) {
  return HOLIDAY_DATES.has(dateOnlyUTC(workDate));
}

export function getHolidayMultiplier(workDate: string | Date) {
  return isHolidayDate(workDate) ? 1.5 : 1;
}

export function calculatePayCents(params: {
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  hourlyRateCents: number;
  workDate: string | Date;
}) {
  const {
    regularMinutes,
    overtimeMinutes,
    doubleMinutes,
    hourlyRateCents,
    workDate,
  } = params;

  const holidayMultiplier = getHolidayMultiplier(workDate);

  const regularPayCents = Math.round(
    (regularMinutes * hourlyRateCents * holidayMultiplier) / 60
  );

  const overtimePayCents = Math.round(
    (overtimeMinutes * hourlyRateCents * 1.5) / 60
  );

  const doublePayCents = Math.round(
    (doubleMinutes * hourlyRateCents * 2) / 60
  );

  const grossPayCents =
    regularPayCents + overtimePayCents + doublePayCents;

  return {
    holidayMultiplier,
    regularPayCents,
    overtimePayCents,
    doublePayCents,
    grossPayCents,
  };
}

export function calculateBillCents(params: {
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  regRateCents: number;
  otRateCents: number;
  dtRateCents: number;
  workDate: string | Date;
}) {
  const {
    regularMinutes,
    overtimeMinutes,
    doubleMinutes,
    regRateCents,
    otRateCents,
    dtRateCents,
    workDate,
  } = params;

  const holidayMultiplier = getHolidayMultiplier(workDate);

  return Math.round(
    (
      regularMinutes * regRateCents * holidayMultiplier +
      overtimeMinutes * otRateCents +
      doubleMinutes * dtRateCents
    ) / 60
  );
}

export function sumBreakMinutesFromEntry(e: any): number {
  const breaks: Array<{ minutes: number | null }> = Array.isArray(e.breaks) ? e.breaks : [];
  if (breaks.length > 0) {
    return breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0);
  }
  return Number(e.breakMinutes ?? 0);
}
export async function getHolidayRule(workDate: string | Date) {
  const dateOnly = dateOnlyUTC(workDate);

  const holiday = await prisma.holiday.findFirst({
    where: {
      date: new Date(`${dateOnly}T00:00:00.000Z`),
      active: true,
    },
    select: {
      id: true,
      name: true,
      payMultiplier: true,
      billMultiplier: true,
      appliesToRegularOnly: true,
    },
  });

  if (holiday) {
    return {
      isHoliday: true,
      name: holiday.name,
      payMultiplier: Number(holiday.payMultiplier || 1.5),
      billMultiplier: Number(holiday.billMultiplier || 1.5),
      appliesToRegularOnly: !!holiday.appliesToRegularOnly,
    };
  }

  return {
    isHoliday: false,
    name: null,
    payMultiplier: 1,
    billMultiplier: 1,
    appliesToRegularOnly: true,
  };
}

export function calculatePayCentsWithRule(params: {
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  hourlyRateCents: number;
  holidayRule: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier: number;
    appliesToRegularOnly: boolean;
  };
}) {
  const {
    regularMinutes,
    overtimeMinutes,
    doubleMinutes,
    hourlyRateCents,
    holidayRule,
  } = params;

  const regularMultiplier =
    holidayRule.isHoliday && holidayRule.appliesToRegularOnly
      ? Number(holidayRule.payMultiplier || 1.5)
      : 1;

  const regularPayCents = Math.round(
    (regularMinutes * hourlyRateCents * regularMultiplier) / 60
  );

  const overtimePayCents = Math.round(
    (overtimeMinutes * hourlyRateCents * 1.5) / 60
  );

  const doublePayCents = Math.round(
    (doubleMinutes * hourlyRateCents * 2) / 60
  );

  const grossPayCents =
    regularPayCents + overtimePayCents + doublePayCents;

  return {
    regularPayCents,
    overtimePayCents,
    doublePayCents,
    grossPayCents,
  };
}

export function calculateBillCentsWithRule(params: {
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  regRateCents: number;
  otRateCents: number;
  dtRateCents: number;
  holidayRule: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier: number;
    appliesToRegularOnly: boolean;
  };
}) {
  const {
    regularMinutes,
    overtimeMinutes,
    doubleMinutes,
    regRateCents,
    otRateCents,
    dtRateCents,
    holidayRule,
  } = params;

  const regularMultiplier =
    holidayRule.isHoliday && holidayRule.appliesToRegularOnly
      ? Number(holidayRule.billMultiplier || 1.5)
      : 1;

  return Math.round(
    (
      regularMinutes * regRateCents * regularMultiplier +
      overtimeMinutes * otRateCents +
      doubleMinutes * dtRateCents
    ) / 60
  );
}
export async function getBillingRun(params: {
  facilityId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceType: "REGULAR" | "SUPPLEMENTAL";
}) {
  const { facilityId, periodStart, periodEnd, invoiceType } = params;

  return prisma.billingRun.findFirst({
    where: {
      facilityId,
      periodStart,
      periodEnd,
      invoiceType,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrCreateBillingRun(params: {
  facilityId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceType: "REGULAR" | "SUPPLEMENTAL";
  invoiceNumber?: string | null;
}) {
  const { facilityId, periodStart, periodEnd, invoiceType, invoiceNumber } = params;

  const existing = await prisma.billingRun.findFirst({
    where: {
      facilityId,
      periodStart,
      periodEnd,
      invoiceType,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.billingRun.create({
    data: {
      facilityId,
      periodStart,
      periodEnd,
      invoiceType,
      invoiceNumber: invoiceNumber || null,
      status: "OPEN",
    },
  });
}

export async function getActiveHolidayDates() {
  const holidays = await prisma.holiday.findMany({
    where: { active: true },
    select: {
      id: true,
      date: true,
      name: true,
      payMultiplier: true,
      billMultiplier: true,
      appliesToRegularOnly: true,
    },
    orderBy: { date: "asc" },
  });

  return holidays.map((h) => ({
    id: h.id,
    date: dateOnlyUTC(h.date),
    name: h.name,
    payMultiplier: Number(h.payMultiplier || 1.5),
    billMultiplier: Number(h.billMultiplier || 1.5),
    appliesToRegularOnly: !!h.appliesToRegularOnly,
  }));
}

export function buildPunchKey(
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

export function computeWorkedMinutes(workDate: string, punches: Punch[]) {
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

export function isCombinablePair(a: "AM" | "PM" | "NOC", b: "AM" | "PM" | "NOC") {
  if ((a === "AM" && b === "NOC") || (a === "NOC" && b === "AM")) return false;

  return (
    (a === "AM" && b === "PM") ||
    (a === "PM" && b === "NOC") ||
    (a === "NOC" && b === "AM")
  );
}

export function validateTwoSegmentContinuity(
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

export function computeBreakRows(workDate: string, breaks: BreakInput[]) {
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

export function findEffectiveFacilityRate(
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

export function calculateTimeEntryTotals(args: {
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

const payCalc = calculatePayCents({
  regularMinutes: buckets.regularMinutes,
  overtimeMinutes: buckets.overtimeMinutes,
  doubleMinutes: buckets.doubleMinutes,
  hourlyRateCents: rateCents,
  workDate,
});

const regularPayCents = payCalc.regularPayCents;
const overtimePayCents = payCalc.overtimePayCents;
const doublePayCents = payCalc.doublePayCents;
const grossPayCents = payCalc.grossPayCents;

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

export function buildExportPunchPairs(entry: any) {
  const workDateISO = entry?.workDate
    ? new Date(entry.workDate).toISOString().slice(0, 10)
    : null;

  function parseValue(v: any): Date | null {
    const s = String(v || "").trim();
    if (!s) return null;

    const asDate = new Date(s);
    if (!Number.isNaN(asDate.getTime()) && s.includes("T")) {
      return asDate;
    }

    if (!workDateISO) return null;
    return parseTimeOnDate(workDateISO, s);
  }

  const punchRanges: Array<{ start: Date; end: Date }> = [];

  if (Array.isArray(entry?.punchesJson) && entry.punchesJson.length > 0) {
    for (const p of entry.punchesJson) {
      const cin = parseValue(p?.clockIn);
      let cout = parseValue(p?.clockOut);
      if (!cin || !cout) continue;

      if (cout.getTime() <= cin.getTime()) {
        cout = new Date(cout.getTime() + 24 * 60 * 60 * 1000);
      }

      punchRanges.push({ start: cin, end: cout });
    }
  } else {
    const start = entry?.startTime ? new Date(entry.startTime) : null;
    const end = entry?.endTime ? new Date(entry.endTime) : null;

    if (start && end) {
      punchRanges.push({ start, end });
    }
  }

  if (punchRanges.length === 0) return [];

  const breaks: Array<{ start: Date; end: Date }> = [];

  if (Array.isArray(entry?.breaksJson) && entry.breaksJson.length > 0) {
    for (const b of entry.breaksJson) {
      const bs = parseValue(b?.startTime);
      let be = parseValue(b?.endTime);
      if (!bs || !be) continue;

      if (be.getTime() <= bs.getTime()) {
        be = new Date(be.getTime() + 24 * 60 * 60 * 1000);
      }

      breaks.push({ start: bs, end: be });
    }
  } else if (Array.isArray(entry?.breaks)) {
    for (const b of entry.breaks) {
      const bs = b?.startTime ? new Date(b.startTime) : null;
      const be = b?.endTime ? new Date(b.endTime) : null;
      if (!bs || !be) continue;
      breaks.push({ start: bs, end: be });
    }
  }

  breaks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const segments: Array<{ clockIn: string; clockOut: string }> = [];

  for (const punch of punchRanges) {
    const overlappingBreaks = breaks
      .filter((br) => br.end > punch.start && br.start < punch.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = punch.start;

    for (const br of overlappingBreaks) {
      const segEnd = br.start < punch.end ? br.start : punch.end;

      if (segEnd > cursor) {
        segments.push({
          clockIn: cursor.toISOString(),
          clockOut: segEnd.toISOString(),
        });
      }

      if (br.end > cursor) {
        cursor = br.end;
      }
    }

    if (cursor < punch.end) {
      segments.push({
        clockIn: cursor.toISOString(),
        clockOut: punch.end.toISOString(),
      });
    }
  }

  return segments;
}

export function styleHeaderRow(ws: any, rowNumber = 1) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell: any) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
  });
}

export async function assertFacilityRateExists(args: {
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

export async function assertEditableNotLocked(timeEntryId: string, req?: any) {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
    select: { id: true, status: true },
  });

  if (!entry) return { ok: false as const, http: 404, msg: "Time entry not found" };

  if (entry.status === "LOCKED") {
    const pinOk = req ? hasValidAdminPin(req) : false;
    if (!pinOk) {
      return { ok: false as const, http: 409, msg: "Time entry is LOCKED and cannot be edited" };
    }
  }

  return { ok: true as const };
}

export async function getBillableWorkRows(params: {
  prisma: any;
  facilityId?: string;
  from: Date;
  toExclusive: Date;
}) {
  const { prisma, facilityId, from, toExclusive } = params;

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      ...(facilityId ? { facilityId: String(facilityId) } : {}),
      workDate: {
        gte: from,
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
          title: true,
          hourlyRateCents: true,
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
          timeEntryId: true,
          startTime: true,
          endTime: true,
          minutes: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
  });

  const adjustments = await prisma.payrollAdjustment.findMany({
  where: {
    ...(facilityId ? { facilityId: String(facilityId) } : {}),
    workDate: {
      gte: from,
      lt: toExclusive,
    },
    isSuperseded: false,
  },
  include: {
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
    facility: {
      select: {
        id: true,
        name: true,
      },
    },
  },
  orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
});

  const rows: any[] = [];

for (const e of timeEntries) {
  const breakMinutes = Array.isArray(e.breaks)
    ? e.breaks.reduce((sum: number, b: any) => sum + Number(b.minutes || 0), 0)
    : Number((e as any).breakMinutes || 0);

  const workedMinutes = Number(e.minutesWorked || 0);
  const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
  const buckets = splitDailyBuckets(payableMinutes);

  rows.push({
    sourceType: "TIME_ENTRY",
    sourceId: e.id,
    billedAt: (e as any).billedAt || null,
    invoiceNumber: (e as any).invoiceNumber || null,
    invoiceType: (e as any).invoiceType || null,

    employeeId: e.employeeId,
    employee: e.employee,
    facilityId: e.facilityId,
    facility: e.facility,
    workDate: e.workDate,
    createdAt: e.createdAt,

    minutesWorked: workedMinutes,
    breakMinutes,
    payableMinutes,

    regularMinutes: buckets.regularMinutes,
    overtimeMinutes: buckets.overtimeMinutes,
    doubleMinutes: buckets.doubleMinutes,

    breaks: e.breaks || [],
    breaksJson:
      Array.isArray(e.breaks) && e.breaks.length > 0
        ? e.breaks.map((b: any) => ({
            startTime: b.startTime,
            endTime: b.endTime,
          }))
        : ((e as any).breaksJson || null),
    punchesJson: (e as any).punchesJson || null,
    notes: e.notes || null,
  });
}

for (const a of adjustments) {
  const payableMinutes = Number(a.payableMinutes || 0);
  const regularMinutes = Number(a.regularMinutes || 0);
  const overtimeMinutes = Number(a.overtimeMinutes || 0);
  const doubleMinutes = Number(a.doubleMinutes || 0);

  rows.push({
    sourceType: "PAYROLL_ADJUSTMENT",
    sourceId: a.id,
    billedAt: (a as any).billedAt || null,
    invoiceNumber: (a as any).invoiceNumber || null,
    invoiceType: (a as any).invoiceType || null,

    employeeId: a.employeeId,
    employee: a.employee,
    facilityId: a.facilityId,
    facility: a.facility,
    workDate: a.workDate,
    createdAt: a.createdAt,

    shiftType: (a as any).shiftType || null,
    minutesWorked: payableMinutes,
    breakMinutes: 0,
    payableMinutes,

    regularMinutes,
    overtimeMinutes,
    doubleMinutes,

    breaks: [],
    punchesJson: (a as any).punchesJson || null,
    breaksJson: (a as any).breaksJson || null,
    notes: a.reason || null,
    amountCents: a.amountCents || 0,
    billAmountCents: (a as any).billAmountCents || null,
  });
}
return rows;
}


