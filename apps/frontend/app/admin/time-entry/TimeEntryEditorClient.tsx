// apps/frontend/app/admin/time-entry/TimeEntryEditorClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";

type Employee = {
  id: string;
  legalName: string;
  preferredName: string | null;
  email: string;
  hourlyRateCents: number;
  title?: string | null;
  active: boolean;
};

type Facility = {
  id: string;
  name: string;
};

type PunchSet = { clockIn: string; clockOut: string };
type BreakSet = { startTime: string; endTime: string };

type CalcResp = {
  input: {
    workDate: string;
    shiftType: string;
    workedMinutes: number;
    breakMinutes: number;
    payableMinutes: number;
  };
  display: {
    totalHours_HHMM: string;
    calculatedHours_decimal: number;
  };
  buckets: {
    regular_HHMM: string;
    overtime_HHMM: string;
    double_HHMM: string;
    regular_decimal: number;
    overtime_decimal: number;
    double_decimal: number;
  };
    billing?: {
    hasRate: boolean;
    regRateCents: number;
    otRateCents: number;
    dtRateCents: number;
    billAmountCents: number;
  } | null;
  holiday?: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier?: number;
    appliesToRegularOnly?: boolean;
  } | null;
  warnings?: string[];
};

export type DayDraft = {
  date: string;
  entryId?: string | null;
  status?: "DRAFT" | "APPROVED" | "LOCKED" | null;
  facilityId: string;
  shiftType: string;
  adjustmentId?: string;
  isMissedAdjustment?: boolean;
  sourceType?: "TIME_ENTRY" | "PAYROLL_ADJUSTMENT";
  p1: PunchSet;
  p2: PunchSet;
  b1: BreakSet;
  b2: BreakSet;
    paidNow?: boolean;
  paidNowAt?: string | null;
  paidNowAmountCents?: number | null;
  paidNowNote?: string | null;
  paidViaPayrollWeek?: boolean;
  addedAfterFinalizedWeek?: boolean;
  isHoliday?: boolean;
  holidayName?: string | null;
  holidayMultiplier?: number | null;
};

export type Draft = {
  startDate: string;
  endDate: string;
  notes: string;
  days: Record<string, DayDraft>;
};

type EntryRow = {
  id: string;
  employeeId: string;
  workDate: string;
  facilityId: string | null;
  shiftType: string;
  status: "DRAFT" | "APPROVED" | "LOCKED";
  notes?: string | null;
  punchesJson?: Array<{ clockIn: string; clockOut: string }> | null;
  breaksJson?: Array<{ startTime: string; endTime: string }> | null;
  facility?: { id: string; name: string } | null;
    paidNow?: boolean;
  paidNowAt?: string | null;
  paidNowAmountCents?: number | null;
  paidNowNote?: string | null;
  paidViaPayrollWeek?: boolean;
  addedAfterFinalizedWeek?: boolean;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function clampEndToMax7(startISO: string, endISO: string) {
  const maxEnd = addDaysISO(startISO, 6);
  return endISO > maxEnd ? maxEnd : endISO;
}

function listDatesInclusive(startISO: string, endISO: string) {
  const out: string[] = [];
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function minutesToHHMM(min: number) {
  const m = Math.max(0, Number(min || 0));
  return (m / 60).toFixed(2);
}

function money(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}


function calcPayCents(
  calc: CalcResp | null,
  hourlyRateCents: number,
  workDate?: string,
  holiday?: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier?: number;
    appliesToRegularOnly?: boolean;
  } | null
) {
  if (!calc) return 0;

  const regularMinutes = Math.round(Number(calc?.buckets?.regular_decimal || 0) * 60);
  const overtimeMinutes = Math.round(Number(calc?.buckets?.overtime_decimal || 0) * 60);
  const doubleMinutes = Math.round(Number(calc?.buckets?.double_decimal || 0) * 60);

  const holidayMultiplier =
    holiday?.isHoliday && holiday?.appliesToRegularOnly !== false
      ? Number(holiday?.payMultiplier || 1.5)
      : 1;

  const regularPayCents = Math.round(
    (regularMinutes * hourlyRateCents * holidayMultiplier) / 60
  );
  const overtimePayCents = Math.round(
    (overtimeMinutes * hourlyRateCents * 1.5) / 60
  );
  const doublePayCents = Math.round(
    (doubleMinutes * hourlyRateCents * 2) / 60
  );

  return regularPayCents + overtimePayCents + doublePayCents;
}
function hoursFromCalcBucket(value: number | undefined | null) {
  return Number(Number(value || 0).toFixed(2));
}

function formatMultiplier(n: number) {
  return `${Number(n || 0).toFixed(1)}x`;
}

function buildPayBreakdown(
  calc: CalcResp | null,
  hourlyRateCents: number,
  holiday?: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier?: number;
    appliesToRegularOnly?: boolean;
  } | null
) {
  if (!calc) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      doubleHours: 0,
      regularMultiplier: 1,
      overtimeMultiplier: 1.5,
      doubleMultiplier: 2,
      regularPayCents: 0,
      overtimePayCents: 0,
      doublePayCents: 0,
      totalPayCents: 0,
    };
  }

  const regularHours = hoursFromCalcBucket(calc?.buckets?.regular_decimal);
  const overtimeHours = hoursFromCalcBucket(calc?.buckets?.overtime_decimal);
  const doubleHours = hoursFromCalcBucket(calc?.buckets?.double_decimal);

  const regularMinutes = Math.round(regularHours * 60);
  const overtimeMinutes = Math.round(overtimeHours * 60);
  const doubleMinutes = Math.round(doubleHours * 60);

  const regularMultiplier =
    holiday?.isHoliday && holiday?.appliesToRegularOnly !== false
      ? Number(holiday?.payMultiplier || 1.5)
      : 1;

  const overtimeMultiplier = 1.5;
  const doubleMultiplier = 2;

  const regularPayCents = Math.round(
    (regularMinutes * hourlyRateCents * regularMultiplier) / 60
  );
  const overtimePayCents = Math.round(
    (overtimeMinutes * hourlyRateCents * overtimeMultiplier) / 60
  );
  const doublePayCents = Math.round(
    (doubleMinutes * hourlyRateCents * doubleMultiplier) / 60
  );

  return {
    regularHours,
    overtimeHours,
    doubleHours,
    regularMultiplier,
    overtimeMultiplier,
    doubleMultiplier,
    regularPayCents,
    overtimePayCents,
    doublePayCents,
    totalPayCents: regularPayCents + overtimePayCents + doublePayCents,
  };
}
function buildBillingBreakdown(
  calc: CalcResp | null,
  holiday?: {
    isHoliday: boolean;
    name: string | null;
    payMultiplier: number;
    billMultiplier?: number;
    appliesToRegularOnly?: boolean;
  } | null
) {
  if (!calc || !calc.billing?.hasRate) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      doubleHours: 0,
      regularMultiplier: 1,
      overtimeMultiplier: 1.5,
      doubleMultiplier: 2,
      regularBillCents: 0,
      overtimeBillCents: 0,
      doubleBillCents: 0,
      totalBillCents: 0,
      hasRate: false,
    };
  }

  const regularHours = hoursFromCalcBucket(calc?.buckets?.regular_decimal);
  const overtimeHours = hoursFromCalcBucket(calc?.buckets?.overtime_decimal);
  const doubleHours = hoursFromCalcBucket(calc?.buckets?.double_decimal);

  const regularMinutes = Math.round(regularHours * 60);
  const overtimeMinutes = Math.round(overtimeHours * 60);
  const doubleMinutes = Math.round(doubleHours * 60);

  const regularMultiplier =
    holiday?.isHoliday && holiday?.appliesToRegularOnly !== false
      ? Number(holiday?.billMultiplier || 1.5)
      : 1;

  const overtimeMultiplier = 1.5;
  const doubleMultiplier = 2;

  const regularBillCents = Math.round(
    (regularMinutes * Number(calc.billing.regRateCents || 0) * regularMultiplier) / 60
  );
  const overtimeBillCents = Math.round(
    (overtimeMinutes * Number(calc.billing.otRateCents || 0) * overtimeMultiplier) / 60
  );
  const doubleBillCents = Math.round(
    (doubleMinutes * Number(calc.billing.dtRateCents || 0) * doubleMultiplier) / 60
  );

  return {
    regularHours,
    overtimeHours,
    doubleHours,
    regularMultiplier,
    overtimeMultiplier,
    doubleMultiplier,
    regularBillCents,
    overtimeBillCents,
    doubleBillCents,
    totalBillCents: regularBillCents + overtimeBillCents + doubleBillCents,
    hasRate: true,
  };
}
function normalizeTimeInput(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";

  if (s.includes("T")) {
  const timePartMatch = s.match(/T(\d{2}):(\d{2})/);
  if (timePartMatch) {
    const hh = Number(timePartMatch[1]);
    const mm = timePartMatch[2];
    const ampm = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${mm} ${ampm}`;
  }
}

  if (/[ap]\.?m\.?/i.test(s)) {
    const cleaned = s
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

    const m12 = cleaned.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)$/i);
    if (m12) {
      const hh = Number(m12[1]);
      const mm = String(m12[2] ?? "00").padStart(2, "0");
      if (hh >= 1 && hh <= 12) return `${hh}:${mm} ${m12[3].toUpperCase()}`;
    }

    return cleaned;
  }

  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let hh = Number(m24[1]);
    const mm = m24[2];
    if (hh < 0 || hh > 23) return s;
    const ampm = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${mm} ${ampm}`;
  }

  const bareHour = s.match(/^(\d{1,2})$/);
  if (bareHour) {
    let hh = Number(bareHour[1]);
    if (hh < 0 || hh > 23) return s;
    const ampm = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:00 ${ampm}`;
  }

  const compact = s.match(/^(\d{3,4})$/);
  if (compact) {
    const digits = compact[1];
    const hh = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const mm = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return s;
    const ampm = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  }

  return s;
}

function defaultDayDraft(date: string): DayDraft {
  return {
    date,
    entryId: null,
    status: null,
    facilityId: "",
    shiftType: "AM",
    p1: { clockIn: "", clockOut: "" },
    p2: { clockIn: "", clockOut: "" },
    b1: { startTime: "", endTime: "" },
    b2: { startTime: "", endTime: "" },
    isHoliday: false,
    holidayName: null,
    holidayMultiplier: null,
  };
}

function defaultDraft(): Draft {
  const start = todayISO();
  const end = addDaysISO(start, 6);
  const dates = listDatesInclusive(start, end);
  const days: Record<string, DayDraft> = {};
  for (const d of dates) days[d] = defaultDayDraft(d);
  return { startDate: start, endDate: end, notes: "", days };
}

function dayHasPunches(day?: DayDraft | null) {
  if (!day) return false;
  const hasP1 = !!(day.p1.clockIn.trim() && day.p1.clockOut.trim());
  const hasP2 = !!(day.p2.clockIn.trim() && day.p2.clockOut.trim());
  return hasP1 || hasP2;
}

function isoToDisplayTime(v?: string | null): string {
  const s = String(v || "").trim();
  if (!s) return "";

  if (/[ap]\.?m\.?/i.test(s) || /^\d{1,2}:\d{2}$/.test(s)) {
    return normalizeTimeInput(s);
  }

  if (s.includes("T")) {
    const timePartMatch = s.match(/T(\d{2}):(\d{2})/);
    if (timePartMatch) {
      const hh = Number(timePartMatch[1]);
      const mm = timePartMatch[2];
      const ampm = hh >= 12 ? "PM" : "AM";
      let h12 = hh % 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${mm} ${ampm}`;
    }
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  return `${h}:${m} ${ampm}`;
}

function statusBadge(day?: DayDraft | null) {
  if (!day?.status) return null;

  const style: React.CSSProperties =
    day.status === "LOCKED"
      ? {
          display: "inline-block",
          marginLeft: 8,
          padding: "2px 6px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: "#fef2f2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
        }
      : day.status === "APPROVED"
      ? {
          display: "inline-block",
          marginLeft: 8,
          padding: "2px 6px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: "#eff6ff",
          color: "#1d4ed8",
          border: "1px solid #bfdbfe",
        }
      : {
          display: "inline-block",
          marginLeft: 8,
          padding: "2px 6px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: "#f3f4f6",
          color: "#374151",
          border: "1px solid #e5e7eb",
        };

  return <span style={style}>{day.status}</span>;
}

export default function TimeEntryEditorClient(props?: {
  initialEmployeeId?: string;
  initialDraft?: Draft;
  lockEmployeeTabs?: boolean;
  allowStatusOverrideEdit?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [calcByEmpDay, setCalcByEmpDay] = useState<Record<string, CalcResp | null>>({});
  const [rateWarningsByEmpDay, setRateWarningsByEmpDay] = useState<Record<string, string>>({});
  const [pickIds, setPickIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    () => (props?.initialEmployeeId ? [props.initialEmployeeId] : [])
  );
  const [activeEmpId, setActiveEmpId] = useState<string>(() => props?.initialEmployeeId || "");

  const [draftsByEmpId, setDraftsByEmpId] = useState<Record<string, Draft>>(() => {
    if (props?.initialEmployeeId && props?.initialDraft) {
      return { [props.initialEmployeeId]: props.initialDraft };
    }
    return {};
  });

  const activeDraft = activeEmpId ? draftsByEmpId[activeEmpId] ?? null : null;
  const activeEmp = activeEmpId ? employees.find((e) => e.id === activeEmpId) ?? null : null;

  const loadSeqRef = useRef(0);
  const calcTimersRef = useRef<Record<string, any>>({});

  const sortedEmployees = useMemo(() => {
    return (employees || [])
      .slice()
      .sort((a, b) => (a.legalName || "").localeCompare(b.legalName || ""));
  }, [employees]);

  const selectedEmployeesSorted = useMemo(() => {
    const set = new Set(selectedEmployeeIds);
    return sortedEmployees.filter((e) => set.has(e.id));
  }, [sortedEmployees, selectedEmployeeIds]);

  const canSaveThisEmployee = useMemo(() => {
    if (!activeEmpId || !activeDraft) return false;
    const days = Object.values(activeDraft.days || {});
    return days.some((d) => dayHasPunches(d));
  }, [activeEmpId, activeDraft]);

  const activeWeekStatusCounts = useMemo(() => {
    if (!activeDraft) {
      return { draft: 0, approved: 0, locked: 0, totalLoaded: 0 };
    }

    const dates = listDatesInclusive(activeDraft.startDate, activeDraft.endDate);
    let draft = 0;
    let approved = 0;
    let locked = 0;
    let totalLoaded = 0;

    for (const date of dates) {
      const day = activeDraft.days?.[date];
      if (!day?.entryId) continue;

      totalLoaded += 1;
      if (day.status === "LOCKED") locked += 1;
      else if (day.status === "APPROVED") approved += 1;
      else draft += 1;
    }

    return { draft, approved, locked, totalLoaded };
  }, [activeDraft]);

  const canApproveWeek = useMemo(() => {
    if (!activeWeekStatusCounts.totalLoaded) return false;
    return activeWeekStatusCounts.draft > 0;
  }, [activeWeekStatusCounts]);

  const canLockWeek = useMemo(() => {
    if (!activeWeekStatusCounts.totalLoaded) return false;
    return activeWeekStatusCounts.draft > 0 || activeWeekStatusCounts.approved > 0;
  }, [activeWeekStatusCounts]);

  const activeWeekTotals = useMemo(() => {
    if (!activeEmpId || !activeDraft) {
      return {
        workedMinutes: 0,
        breakMinutes: 0,
        payableMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        doubleMinutes: 0,
      };
    }

    const dates = listDatesInclusive(activeDraft.startDate, activeDraft.endDate);

    let workedMinutes = 0;
    let breakMinutes = 0;
    let payableMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    let doubleMinutes = 0;

    for (const date of dates) {
      const calc = calcByEmpDay[`${activeEmpId}__${date}`];
      if (!calc) continue;

      workedMinutes += Number(calc.input.workedMinutes || 0);
      breakMinutes += Number(calc.input.breakMinutes || 0);
      payableMinutes += Number(calc.input.payableMinutes || 0);

      regularMinutes += Math.round(Number(calc.buckets.regular_decimal || 0) * 60);
      overtimeMinutes += Math.round(Number(calc.buckets.overtime_decimal || 0) * 60);
      doubleMinutes += Math.round(Number(calc.buckets.double_decimal || 0) * 60);
    }

    return {
      workedMinutes,
      breakMinutes,
      payableMinutes,
      regularMinutes,
      overtimeMinutes,
      doubleMinutes,
    };
  }, [activeEmpId, activeDraft, calcByEmpDay]);

  function isApprovedOrLocked(day?: DayDraft | null) {
    if (props?.allowStatusOverrideEdit) return false;
    return day?.status === "APPROVED" || day?.status === "LOCKED";
  }

  function ensureDraftRange(empId: string, patch: Partial<Draft>) {
    setDraftsByEmpId((prev) => {
      const current = prev[empId] ?? defaultDraft();
      const merged: Draft = {
        ...current,
        ...patch,
        notes: (patch.notes ?? current.notes) as string,
        days: { ...(current.days || {}) },
      };

      const start = merged.startDate || todayISO();
      let end = merged.endDate || start;
      end = clampEndToMax7(start, end);

      const dates = listDatesInclusive(start, end);
      const newDays: Draft["days"] = {};
      for (const d of dates) newDays[d] = merged.days[d] ?? defaultDayDraft(d);

      return {
        ...prev,
        [empId]: { ...merged, startDate: start, endDate: end, days: newDays },
      };
    });
  }

  function updateDay(empId: string, date: string, patch: Partial<DayDraft>) {
    setDraftsByEmpId((prev) => {
      const d = prev[empId] ?? defaultDraft();
      const cur = d.days?.[date] ?? defaultDayDraft(date);
      const nextDay = { ...cur, ...patch } as DayDraft;
      return {
        ...prev,
        [empId]: { ...d, days: { ...d.days, [date]: nextDay } },
      };
    });
  }

  async function calcDay(empId: string, date: string, day: DayDraft) {
    const punches = [day.p1, day.p2]
      .filter((p) => String(p?.clockIn || "").trim() && String(p?.clockOut || "").trim())
      .map((p) => ({
        clockIn: normalizeTimeInput(String(p.clockIn || "").trim()),
        clockOut: normalizeTimeInput(String(p.clockOut || "").trim()),
      }));

      const breaks = [day.b1, day.b2]
  .filter((b) => {
    const start = normalizeTimeInput(String(b?.startTime || "").trim());
    const end = normalizeTimeInput(String(b?.endTime || "").trim());
    const valid = /^(?:\d{1,2}:\d{2}\s?(?:AM|PM)|\d{1,2}:\d{2})$/i;
    return valid.test(start) && valid.test(end);
  })
	.map((b) => ({
        startTime: normalizeTimeInput(String(b.startTime || "").trim()),
        endTime: normalizeTimeInput(String(b.endTime || "").trim()),
      }));

    if (punches.length === 0) {
      setCalcByEmpDay((prev) => ({ ...prev, [`${empId}__${date}`]: null }));
      return;
    }

        const shiftValidationErr = validateShiftTypeAgainstPunches(day);
    if (shiftValidationErr) {
      setCalcByEmpDay((prev) => ({ ...prev, [`${empId}__${date}`]: null }));
      throw new Error(shiftValidationErr);
    }

    const qs = new URLSearchParams();
    qs.set("workDate", date);
    qs.set("shiftType", day.shiftType || "AM");
    qs.set("punches", JSON.stringify(punches));
    qs.set("breaks", JSON.stringify(breaks));
    qs.set("employeeId", empId);
    qs.set("facilityId", String(day.facilityId || ""));


    const apiUrl = `/api/admin/time-entry/calc?${qs.toString()}`;

    try {
      const resp = await apiFetch<CalcResp>(apiUrl);
      setCalcByEmpDay((prev) => ({ ...prev, [`${empId}__${date}`]: resp }));
    } catch (e: any) {
      console.error("calc endpoint error", apiUrl, e);
      throw e;
    }
  }

  function scheduleCalc(empId: string, date: string, day: DayDraft) {
    const key = `${empId}__${date}`;
    if (calcTimersRef.current[key]) clearTimeout(calcTimersRef.current[key]);

    calcTimersRef.current[key] = setTimeout(async () => {
      try {
        await calcDay(empId, date, day);
      } catch (e: any) {
        console.error("calc failed", { empId, date, e });
        setCalcByEmpDay((prev) => ({ ...prev, [key]: null }));
        setErr((prev) => prev || (e?.message ?? "Calc failed"));
      }
       try {
      await checkFacilityRate(empId, date, day);
    } catch (e) {
      console.error("rate check failed", e);
    }
    }, 350);
  }

  async function checkFacilityRate(empId: string, date: string, day: DayDraft) {
  const key = `${empId}__${date}`;

  if (!empId || !date || !String(day.facilityId || "").trim()) {
    setRateWarningsByEmpDay((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    return;
  }

  try {
    const resp = await apiFetch<{
      ok: boolean;
      hasRate: boolean;
      reason?: string | null;
      employeeTitle?: string | null;
      facilityName?: string | null;
      effectiveRate?: {
        effectiveFrom: string;
        regRateCents: number;
        otRateCents: number;
        dtRateCents: number;
      } | null;
    }>(
      `/api/admin/facilities/${encodeURIComponent(day.facilityId)}/rate-check?employeeId=${encodeURIComponent(
        empId
      )}&workDate=${encodeURIComponent(date)}`
    );

    if (!resp.hasRate) {
      const title = resp.employeeTitle || "employee title";
      const facilityName = resp.facilityName || "selected facility";

      setRateWarningsByEmpDay((prev) => ({
        ...prev,
        [key]: `Missing billing rate for ${title} at ${facilityName} on ${date}.`,
      }));
    } else {
      setRateWarningsByEmpDay((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  } catch (e: any) {
    setRateWarningsByEmpDay((prev) => ({
      ...prev,
      [key]: e?.message || "Unable to validate facility billing rate.",
    }));
  }
}
  useEffect(() => {
    if (!activeEmpId || !activeDraft) return;

    const dates = listDatesInclusive(activeDraft.startDate, activeDraft.endDate);

    for (const date of dates) {
      const day = activeDraft.days?.[date];
      if (!day) continue;

      checkFacilityRate(activeEmpId, date, day).catch(() => {});

      if (!dayHasPunches(day)) {
        setCalcByEmpDay((prev) => ({ ...prev, [`${activeEmpId}__${date}`]: null }));
        continue;
      }

      scheduleCalc(activeEmpId, date, day);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmpId, activeDraft?.startDate, activeDraft?.endDate, activeDraft?.days]);

  function updateDayPunch(
    empId: string,
    date: string,
    which: "p1" | "p2",
    key: keyof PunchSet,
    val: string
  ) {
    setDraftsByEmpId((prev) => {
      const d = prev[empId] ?? defaultDraft();
      const curDay = d.days?.[date] ?? defaultDayDraft(date);
      const curPunch = curDay[which] ?? { clockIn: "", clockOut: "" };
      const nextDay: DayDraft = { ...curDay, [which]: { ...curPunch, [key]: val } as any };
      setTimeout(() => scheduleCalc(empId, date, nextDay), 0);
      return { ...prev, [empId]: { ...d, days: { ...d.days, [date]: nextDay } } };
    });
  }

  function updateDayBreak(
    empId: string,
    date: string,
    which: "b1" | "b2",
    key: keyof BreakSet,
    val: string
  ) {
    setDraftsByEmpId((prev) => {
      const d = prev[empId] ?? defaultDraft();
      const curDay = d.days?.[date] ?? defaultDayDraft(date);
      const curBreak = curDay[which] ?? { startTime: "", endTime: "" };
      const nextDay: DayDraft = { ...curDay, [which]: { ...curBreak, [key]: val } as any };
      setTimeout(() => scheduleCalc(empId, date, nextDay), 0);
      return { ...prev, [empId]: { ...d, days: { ...d.days, [date]: nextDay } } };
    });
  }

  function normalizeTimesOnBlur(empId: string, date: string) {
    setDraftsByEmpId((prev) => {
      const d = prev[empId];
      if (!d) return prev;
      const day = d.days?.[date];
      if (!day) return prev;

      const norm: DayDraft = {
        ...day,
        p1: { clockIn: normalizeTimeInput(day.p1.clockIn), clockOut: normalizeTimeInput(day.p1.clockOut) },
        p2: { clockIn: normalizeTimeInput(day.p2.clockIn), clockOut: normalizeTimeInput(day.p2.clockOut) },
        b1: { startTime: normalizeTimeInput(day.b1.startTime), endTime: normalizeTimeInput(day.b1.endTime) },
        b2: { startTime: normalizeTimeInput(day.b2.startTime), endTime: normalizeTimeInput(day.b2.endTime) },
      };

      setTimeout(() => scheduleCalc(empId, date, norm), 0);
      return { ...prev, [empId]: { ...d, days: { ...d.days, [date]: norm } } };
    });
  }

    function validateShiftTypeAgainstPunches(day: DayDraft) {
    const hasP1 =
      !!String(day?.p1?.clockIn || "").trim() &&
      !!String(day?.p1?.clockOut || "").trim();

    const hasP2 =
      !!String(day?.p2?.clockIn || "").trim() &&
      !!String(day?.p2?.clockOut || "").trim();

    const isCombinedShift =
      day.shiftType === "AM+PM" ||
      day.shiftType === "PM+NOC" ||
      day.shiftType === "NOC+AM";

    if (hasP2 && !isCombinedShift) {
      return "You entered punches for two shifts. Please select a combined Shift Type (AM+PM, PM+NOC, or NOC+AM).";
    }

    if (!hasP2 && isCombinedShift) {
      return "You selected a combined Shift Type, but second-shift punches are missing.";
    }

    if (!hasP1 && hasP2) {
      return "Shift 1 punches are required before entering Shift 2 punches.";
    }

    return "";
  }

  async function loadEmployees() {
    const resp = await apiFetch<{ employees: Employee[] }>("/api/admin/employees");
    setEmployees(resp.employees || []);
  }

  async function loadFacilities() {
    const resp = await apiFetch<{ facilities: Facility[] }>("/api/admin/facilities");
    setFacilities(resp.facilities || []);
  }

function mapEntryToDayPatch(e: EntryRow & { breaks?: Array<{ startTime: string; endTime: string; minutes?: number }> }): Partial<DayDraft> {
  const punches = Array.isArray(e.punchesJson) ? e.punchesJson : [];

  const breaksSource =
    Array.isArray((e as any).breaks) && (e as any).breaks.length > 0
      ? (e as any).breaks
      : Array.isArray(e.breaksJson)
      ? e.breaksJson
      : [];

  const p1 = punches[0] || null;
  const p2 = punches[1] || null;
  const b1 = breaksSource[0] || null;
  const b2 = breaksSource[1] || null;

  return {
    entryId: e.id,
    status: e.status,
    facilityId: e.facilityId || "",
    shiftType: e.shiftType || "AM",
        paidNow: !!(e as any).paidNow,
    paidNowAt: (e as any).paidNowAt || null,
    paidNowAmountCents: Number((e as any).paidNowAmountCents || 0),
    paidNowNote: (e as any).paidNowNote || null,
    paidViaPayrollWeek: !!(e as any).paidViaPayrollWeek,
    addedAfterFinalizedWeek: !!(e as any).addedAfterFinalizedWeek,
    p1: { clockIn: isoToDisplayTime(p1?.clockIn), clockOut: isoToDisplayTime(p1?.clockOut) },
    p2: { clockIn: isoToDisplayTime(p2?.clockIn), clockOut: isoToDisplayTime(p2?.clockOut) },
    b1: { startTime: isoToDisplayTime(b1?.startTime), endTime: isoToDisplayTime(b1?.endTime) },
    b2: { startTime: isoToDisplayTime(b2?.startTime), endTime: isoToDisplayTime(b2?.endTime) },
  };
}
  async function hydrateDraftFromServer(empId: string, start: string, end: string) {
    const seq = ++loadSeqRef.current;

    const qs = new URLSearchParams();
    qs.set("employeeId", empId);
    qs.set("from", start);
    qs.set("to", end);

    const resp = await apiFetch<{ entries: EntryRow[] }>(`/api/admin/time-entries?${qs.toString()}`);
    if (seq !== loadSeqRef.current) return;

    const list = resp.entries || [];

    setDraftsByEmpId((prev) => {
        const current = prev[empId] ?? defaultDraft();
const dates = listDatesInclusive(start, end);

const freshDays: Record<string, DayDraft> = {};
for (const d of dates) {
  freshDays[d] = defaultDayDraft(d);
}

for (const e of list) {
  const dateISO = String(e.workDate).slice(0, 10);
  if (!freshDays[dateISO]) continue;
  freshDays[dateISO] = {
    ...freshDays[dateISO],
    ...mapEntryToDayPatch(e),
  } as DayDraft;
}

const next: Draft = {
  ...current,
  startDate: start,
  endDate: end,
  days: freshDays,
};


      return { ...prev, [empId]: next };
    });
  }

  function openTabsForSelected() {
    if (pickIds.length === 0) return;

    const sortedPicked = pickIds
      .slice()
      .sort((a, b) => {
        const ea = sortedEmployees.find((e) => e.id === a);
        const eb = sortedEmployees.find((e) => e.id === b);
        return (ea?.legalName || "").localeCompare(eb?.legalName || "");
      });

    setSelectedEmployeeIds(sortedPicked);

    setDraftsByEmpId((prev) => {
      const next = { ...prev };
      for (const id of sortedPicked) if (!next[id]) next[id] = defaultDraft();
      return next;
    });

    setActiveEmpId((prev) => (sortedPicked.includes(prev) ? prev : sortedPicked[0]));
  }

  useEffect(() => {
    loadEmployees().catch((e: any) => setErr(e?.message || "Failed to load employees"));
    loadFacilities().catch((e: any) => setErr(e?.message || "Failed to load facilities"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeEmpId && !props?.lockEmployeeTabs) return;
    if (activeEmpId && !draftsByEmpId[activeEmpId]) {
      setDraftsByEmpId((prev) => ({ ...prev, [activeEmpId]: defaultDraft() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmpId]);

  useEffect(() => {
    if (props?.lockEmployeeTabs) return;
    if (!activeEmpId) return;
    const d = draftsByEmpId[activeEmpId] ?? null;
    if (!d) return;

    const start = d.startDate || todayISO();
    const end = clampEndToMax7(start, d.endDate || start);

    ensureDraftRange(activeEmpId, { startDate: start, endDate: end });
    hydrateDraftFromServer(activeEmpId, start, end).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmpId, draftsByEmpId[activeEmpId]?.startDate, draftsByEmpId[activeEmpId]?.endDate]);

  async function saveDay(empId: string, date: string, day: DayDraft, notes: string) {
  const punches = [day.p1, day.p2]
    .filter((p) => String(p?.clockIn || "").trim() && String(p?.clockOut || "").trim())
    .map((p) => ({
      clockIn: normalizeTimeInput(String(p.clockIn || "").trim()),
      clockOut: normalizeTimeInput(String(p.clockOut || "").trim()),
    }));

  if (punches.length === 0) return { didSave: false, resetToDraft: false };

  if (!String(day.facilityId || "").trim()) {
    throw new Error(`Please select a facility for ${date} before saving.`);
  }
  
    const shiftValidationErr = validateShiftTypeAgainstPunches(day);
  if (shiftValidationErr) {
    throw new Error(`${date}: ${shiftValidationErr}`);
  }

  const breaks = [day.b1, day.b2]
    .filter((b) => String(b?.startTime || "").trim() && String(b?.endTime || "").trim())
    .map((b) => ({
      startTime: normalizeTimeInput(String(b.startTime || "").trim()),
      endTime: normalizeTimeInput(String(b.endTime || "").trim()),
    }));

  const isAdjustment =
    !!day?.isMissedAdjustment ||
    day?.sourceType === "PAYROLL_ADJUSTMENT" ||
    !!day?.adjustmentId;

  const shouldResetToDraft =
    !isAdjustment &&
    !!props?.allowStatusOverrideEdit &&
    (day.status === "APPROVED" || day.status === "LOCKED");

  const payload = {
    employeeId: empId,
    workDate: date,
    facilityId: day.facilityId,
    shiftType: day.shiftType,
    punches,
    breaks,
    notes: notes?.trim() ? notes.trim() : undefined,
    ...(shouldResetToDraft ? { status: "DRAFT" } : {}),
  };

  if (isAdjustment) {
    const adjustmentId = String(day.adjustmentId || "").trim();
    if (!adjustmentId) {
      throw new Error(`Missing adjustmentId for ${date}`);
    }
    const shiftValidationErr = validateShiftTypeAgainstPunches(day);
  if (shiftValidationErr) {
    throw new Error(`${date}: ${shiftValidationErr}`);
  }
    await apiFetch(
      `/api/admin/payroll-adjustments/${encodeURIComponent(adjustmentId)}/correction`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return { didSave: true, resetToDraft: false };
  }

  if (day.entryId) {
    await apiFetch(`/api/admin/time-entry/${encodeURIComponent(day.entryId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    if (shouldResetToDraft) {
      updateDay(empId, date, { status: "DRAFT" });
    }
  } else {
    const created = await apiFetch<{ entry: { id: string } }>("/api/admin/time-entry", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const newId = (created as any)?.entry?.id;
    if (newId) updateDay(empId, date, { entryId: newId });
  }

  return { didSave: true, resetToDraft: shouldResetToDraft };
}
 
  async function saveWeekForEmployee(empId: string) {
  const draft = draftsByEmpId[empId];
  if (!draft) return { savedDays: 0, resetToDraftCount: 0 };

  const dates = listDatesInclusive(draft.startDate, draft.endDate);
  let savedDays = 0;
  let resetToDraftCount = 0;

  for (const date of dates) {
    const day = draft.days?.[date];
    if (!day) continue;
    const r = await saveDay(empId, date, day, draft.notes);
    if (r.didSave) savedDays++;
    if (r.resetToDraft) resetToDraftCount++;
  }

  return { savedDays, resetToDraftCount };
}

  async function saveWeekForActiveTab() {
    setErr("");
    setOk("");

    if (!activeEmpId || !activeDraft) {
      setErr("Pick an employee tab first.");
      return;
    }

    const confirm = window.confirm(`Save entries for ${activeEmp?.legalName || activeEmpId}?`);
    if (!confirm) return;

    setLoading(true);
    try {

      const { savedDays, resetToDraftCount } = await saveWeekForEmployee(activeEmpId);
if (savedDays === 0) {
  throw new Error("Nothing saved: fill at least one Clock In/Clock Out for a day.");
}

if (resetToDraftCount > 0) {
  setOk(
    `Saved ${savedDays} day(s) for ${activeEmp?.legalName || activeEmpId}. ` +
      `${resetToDraftCount} edited approved/locked entr${
        resetToDraftCount === 1 ? "y was" : "ies were"
      } reset to DRAFT for review.`
  );
} else {
  setOk(`Saved ${savedDays} day(s) for ${activeEmp?.legalName || activeEmpId}.`);
}
      if (!props?.lockEmployeeTabs) {
        await hydrateDraftFromServer(activeEmpId, activeDraft.startDate, activeDraft.endDate);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save time entries");
    } finally {
      setLoading(false);
    }
  }

  async function approveWeekForActiveTab() {
    setErr("");
    setOk("");

    if (!activeEmpId || !activeDraft) {
      setErr("Pick an employee tab first.");
      return;
    }

    const confirmApprove = window.confirm(
      `Approve this week for ${activeEmp?.legalName || activeEmpId}?`
    );
    if (!confirmApprove) return;

    setLoading(true);
    try {
      const resp = await apiFetch<{ ok: true; approvedCount: number }>(
        "/api/admin/time-entry/approve-week",
        {
          method: "POST",
          body: JSON.stringify({
            employeeId: activeEmpId,
            startDate: activeDraft.startDate,
            endDate: activeDraft.endDate,
          }),
        }
      );

      setOk(
        `Approved ${resp.approvedCount} entr${resp.approvedCount === 1 ? "y" : "ies"} for ${
          activeEmp?.legalName || activeEmpId
        }.`
      );

      if (!props?.lockEmployeeTabs) {
        await hydrateDraftFromServer(activeEmpId, activeDraft.startDate, activeDraft.endDate);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to approve week");
    } finally {
      setLoading(false);
    }
  }

  async function lockWeekForActiveTab() {
    setErr("");
    setOk("");

    if (!activeEmpId || !activeDraft) {
      setErr("Pick an employee tab first.");
      return;
    }

    const confirmLock = window.confirm(
      `Lock this week for ${activeEmp?.legalName || activeEmpId}? Locked entries should not be edited.`
    );
    if (!confirmLock) return;

    setLoading(true);
    try {
      const resp = await apiFetch<{ ok: true; lockedCount: number }>(
        "/api/admin/time-entry/lock-week",
        {
          method: "POST",
          body: JSON.stringify({
            employeeId: activeEmpId,
            startDate: activeDraft.startDate,
            endDate: activeDraft.endDate,
          }),
        }
      );

      setOk(
        `Locked ${resp.lockedCount} entr${resp.lockedCount === 1 ? "y" : "ies"} for ${
          activeEmp?.legalName || activeEmpId
        }.`
      );

      if (!props?.lockEmployeeTabs) {
        await hydrateDraftFromServer(activeEmpId, activeDraft.startDate, activeDraft.endDate);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to lock week");
    } finally {
      setLoading(false);
    }
  }



async function payNowForDay(date: string, day: DayDraft) {
  try {
    setErr("");
    setOk("");

    if (!day?.entryId) {
      setErr("Save this day first before paying.");
      return;
    }

    if (day.sourceType === "PAYROLL_ADJUSTMENT" || day.isMissedAdjustment) {
      setErr("Use the Payroll Adjustment flow for adjustment rows.");
      return;
    }

    if (day.status !== "APPROVED" && day.status !== "LOCKED") {
      setErr("Only APPROVED or LOCKED entries can be paid now.");
      return;
    }

    const calc = calcByEmpDay[`${activeEmpId}__${date}`];
  
    const payCents = calcPayCents(
  calc,
  Number(activeEmp?.hourlyRateCents || 0),
  date
);
    
    if (!calc || payCents <= 0) {
      setErr("This day does not have a valid calculated amount yet.");
      return;
    }

    const confirmPay = window.confirm(
      `Pay this time entry now for ${date} for $${(payCents / 100).toFixed(2)}?`
    );
    if (!confirmPay) return;

    const paidNote = window.prompt("Optional payment note", "Paid now from time entry");
    if (paidNote === null) return;

    setLoading(true);

    const resp = await apiFetch<{ ok: boolean; amountCents: number }>(
      `/api/admin/time-entry/${encodeURIComponent(day.entryId)}/pay-now`,
      {
        method: "POST",
        body: JSON.stringify({ paidNote }),
      }
    );

    setOk(
      `Paid ${date} immediately: $${(Number(resp.amountCents || 0) / 100).toFixed(2)}`
    );

    if (!props?.lockEmployeeTabs && activeEmpId && activeDraft) {
      await hydrateDraftFromServer(activeEmpId, activeDraft.startDate, activeDraft.endDate);
    }
  } catch (e: any) {
    setErr(e?.message || "Failed to pay this entry now");
  } finally {
    setLoading(false);
  }
}
  async function saveWeekForAllTabs() {
    setErr("");
    setOk("");

    if (selectedEmployeeIds.length === 0) {
      setErr("Select employees and open tabs first.");
      return;
    }

    const confirm = window.confirm(
      `Save entries for ALL open tabs (${selectedEmployeeIds.length} employees)?`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      for (const empId of selectedEmployeeIds) {
        const draft = draftsByEmpId[empId];
        if (!draft) continue;

        const dates = listDatesInclusive(draft.startDate, draft.endDate);
        const missing = dates.find((dt) => {
          const day = draft.days?.[dt];
          if (!dayHasPunches(day)) return false;
          return !String(day?.facilityId || "").trim();
        });

        if (missing) {
          const emp = employees.find((e) => e.id === empId);
          throw new Error(`Missing facility for ${emp ? emp.legalName : empId} on ${missing}.`);
        }
      }

      let totalSaved = 0;
      for (const empId of selectedEmployeeIds) {
        const { savedDays } = await saveWeekForEmployee(empId);
        totalSaved += savedDays;
      }

      if (totalSaved === 0) {
        throw new Error("Nothing saved: fill at least one day for at least one employee.");
      }

      setOk(`Saved ${totalSaved} day(s) across ${selectedEmployeeIds.length} employee(s).`);

      if (!props?.lockEmployeeTabs && activeEmpId) {
        const d = draftsByEmpId[activeEmpId];
        if (d) await hydrateDraftFromServer(activeEmpId, d.startDate, d.endDate);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save for all employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!props?.lockEmployeeTabs) return;
    if (!activeEmpId) return;
    if (!draftsByEmpId[activeEmpId]) {
      setDraftsByEmpId((prev) => ({
        ...prev,
        [activeEmpId]: props?.initialDraft ?? defaultDraft(),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
       <div
  style={{
    padding: 0,
    maxWidth: 1300,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
  }}
>
<h1
  style={{
    fontSize: 30,
    fontWeight: 800,
    marginBottom: 10,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  }}
>
  Admin — Time Entry
</h1>
      {!props?.lockEmployeeTabs ? (
          <div
  style={{
    marginTop: 16,
    padding: 20,
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>
<div
  style={{
    fontWeight: 800,
    marginBottom: 12,
    color: "#0f172a",
    fontSize: 18,
  }}
>
  Select Employees → Open Tabs
</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
	    <select
              multiple
              value={pickIds}
              onChange={(e) => setPickIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
              style={{
  minWidth: 420,
  height: 180,
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
            >
              {sortedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.legalName} ({emp.email}){emp.title ? ` — ${emp.title}` : ""}
                </option>
              ))}
            </select>
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={openTabsForSelected}
                style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.10)",
}}
	      >
                Open Tabs ({pickIds.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickIds([]);
                  setSelectedEmployeeIds([]);
                  setActiveEmpId("");
                }}
                 style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
}}
	      >
                Clear
              </button>
            </div>
          </div>

          {selectedEmployeeIds.length > 0 ? (
             <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}> 
		{selectedEmployeesSorted.map((emp) => {
                const id = emp.id;
                const label = emp.preferredName || emp.legalName;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveEmpId(id)}
                    style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: activeEmpId === id ? "1px solid #0f172a" : "1px solid #cbd5e1",
  background: activeEmpId === id ? "#0f172a" : "#ffffff",
  color: activeEmpId === id ? "#ffffff" : "#0f172a",
  cursor: "pointer",
  fontWeight: 700,
}}
			title={`${emp.legalName} (${emp.email})`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
              <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
		Select employees, then click Open Tabs.
            </div>
          )}
        </div>
      ) : null}

      {activeEmpId && activeDraft ? (
          <div
  style={{
    marginTop: 18,
    padding: 20,
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
             <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#0f172a" }}> 
		 Enter Week — {activeEmp ? activeEmp.legalName : activeEmpId}
            </h2>
              <div style={{ fontSize: 12, color: "#64748b" }}>
	      Tip: type <b>13:00</b> and we’ll infer <b>PM</b> on blur.
            </div>
          </div>
          
	    {props?.allowStatusOverrideEdit && (
            <div
              style={{
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: 13,
  fontWeight: 700,
}}
	    >
              PIN Override Mode — editing an approved or locked entry will reset it to DRAFT when saved.
            </div>
          )}
	    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Start Date</div>
              <input
                value={activeDraft.startDate}
                onChange={(e) => {
                  const start = e.target.value;
                  const end = clampEndToMax7(start, activeDraft.endDate || start);
                  ensureDraftRange(activeEmpId, { startDate: start, endDate: end });
                }}
                type="date"
                style={{
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	        disabled={!!props?.lockEmployeeTabs}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>End Date (max 7 days)</div>
              <input
                value={activeDraft.endDate}
                onChange={(e) => {
                  const end = clampEndToMax7(activeDraft.startDate, e.target.value);
                  ensureDraftRange(activeEmpId, { endDate: end });
                }}
                type="date"
                style={{
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
		disabled={!!props?.lockEmployeeTabs}
              />
            </div>

            <div style={{ flex: "1 1 360px" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>
  Notes (applies to saved entries)
</div>
	      <input
                value={activeDraft.notes}
                onChange={(e) => ensureDraftRange(activeEmpId, { notes: e.target.value })}
                placeholder="Optional notes"
                style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	      />
            </div>

            <button
              disabled={loading || !canSaveThisEmployee}
              onClick={saveWeekForActiveTab}
              style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  height: 42,
  fontWeight: 700,
  opacity: loading || !canSaveThisEmployee ? 0.6 : 1,
}}
	    >
              Save (this employee)
            </button>

            <button
              type="button"
              disabled={loading || !activeEmpId || !activeDraft || !canApproveWeek}
              onClick={approveWeekForActiveTab}
                style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
		color: "#1d4ed8",
                height: 42,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading || !activeEmpId || !activeDraft || !canApproveWeek ? 0.6 : 1,
              }}
            >
              Approve Week
            </button>

            <button
              type="button"
              disabled={loading || !activeEmpId || !activeDraft || !canLockWeek}
              onClick={lockWeekForActiveTab}
              style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  height: 42,
  fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer",
  opacity: loading || !activeEmpId || !activeDraft || !canLockWeek ? 0.6 : 1,
}}
	    >
              Lock Week
            </button>

            {!props?.lockEmployeeTabs ? (
              <button
                disabled={loading || selectedEmployeeIds.length === 0}
                onClick={saveWeekForAllTabs}
                style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  height: 42,
  fontWeight: 700,
  opacity: loading || selectedEmployeeIds.length === 0 ? 0.6 : 1,
}}
	      >
                Save (all open tabs)
              </button>
            ) : null}
          </div>

          {Object.values(activeDraft.days || {}).some(
            (d) => dayHasPunches(d) && !String(d.facilityId || "").trim()
          ) ? (
             <div
  style={{
    marginTop: 10,
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    display: "inline-block",
  }}
> 
		Please select a Facility for each worked day before saving.
            </div>
          ) : null}

          <div
            style={{
  marginTop: 14,
  marginBottom: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
}}
	  >
            <div
              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
}}
	    >
              Loaded: {activeWeekStatusCounts.totalLoaded}
            </div>

            <div
              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
}}
	    >
              Draft: {activeWeekStatusCounts.draft}
            </div>

            <div
              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 700,
}}
	    >
              Approved: {activeWeekStatusCounts.approved}
            </div>

            <div
              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
}}
	    >
              Locked: {activeWeekStatusCounts.locked}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
	  <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 18, color: "#0f172a" }}>
  Week Grid (preloads existing entries)
</div>
            <div
              style={{
  marginBottom: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  background: "#f8fafc",
  display: "inline-block",
}}
	    >
	     <div style={{ fontWeight: 800, marginBottom: 8, color: "#0f172a" }}>Week Totals</div> 
	     <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: "#334155" }}>
  <div>
    Payable: <b>{minutesToHHMM(activeWeekTotals.payableMinutes)}</b>
  </div>
  <div>
    Reg: <b>{minutesToHHMM(activeWeekTotals.regularMinutes)}</b>
  </div>
  <div>
    OT: <b>{minutesToHHMM(activeWeekTotals.overtimeMinutes)}</b>
  </div>
  <div>
    DT: <b>{minutesToHHMM(activeWeekTotals.doubleMinutes)}</b>
  </div>
</div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  minWidth: 1900,
                  display: "grid",
                  gridTemplateColumns: "140px 260px 160px repeat(8, 120px) 320px",
                  gap: 8,
                  alignItems: "center",
                  paddingBottom: 6,
                }}
              >
		<div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Date</div>
<div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Facility</div>
<div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Shift</div>
		
                {[
                  "Clock In",
                  "Meal Out",
                  "Meal In",
                  "Clock Out",
                  "Clock In",
                  "Meal Out",
                  "Meal In",
                  "Clock Out",
                ].map((h, i) => (
                 <div
  key={`${h}-${i}`}
  style={{
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  {h}
</div>
	        ))}

<div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pay Summary</div>
                {listDatesInclusive(activeDraft.startDate, activeDraft.endDate).map((date) => {
		  const day = activeDraft.days?.[date] ?? defaultDayDraft(date);
const calcKey = `${activeEmpId}__${date}`;
const calc = calcByEmpDay[calcKey];
const rateWarning = rateWarningsByEmpDay[calcKey];

const isHoliday = !!calc?.holiday?.isHoliday || !!day.isHoliday;
const holidayName = calc?.holiday?.name || day.holidayName || null;
const holidayMultiplier =
  calc?.holiday?.payMultiplier || day.holidayMultiplier || 1;

const payCents = calcPayCents(
  calc,
  Number(activeEmp?.hourlyRateCents || 0),
  date,
  calc?.holiday || null
);
const payBreakdown = buildPayBreakdown(
  calc,
  Number(activeEmp?.hourlyRateCents || 0),
  calc?.holiday || null
);

const billingBreakdown = buildBillingBreakdown(
  calc,
  calc?.holiday || null
);

const marginCents =
  Number(billingBreakdown.totalBillCents || 0) -
  Number(payBreakdown.totalPayCents || 0);

                  return (
                    <React.Fragment key={date}>
                    <div
style={{
  fontSize: 13,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  background: isHoliday ? "#fffaf0" : "#ffffff",
  border: isHoliday ? "1px solid #f59e0b" : "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 10,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
>    
<div style={{ whiteSpace: "nowrap", color: "#0f172a", fontWeight: 700 }}> 
 {date}
{isHoliday ? (
  <div
    style={{
  marginTop: 6,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #f59e0b",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: 11,
  fontWeight: 700,
}}
  >
    🎉 {holidayName || "Holiday"}
    <div style={{ fontWeight: 500 }}>
      Regular hours @ {holidayMultiplier}x
    </div>
  </div>
) : null}

{day.entryId ? (
 <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b", fontWeight: 500 }}>(loaded)</span> 
 ) : null}
</div>
			{day.status ? statusBadge(day) : null}
			
                        {day.entryId &&
		        !day.paidNow &&
		        !day.paidViaPayrollWeek &&	
                        !day.isMissedAdjustment &&
			 day.sourceType !== "PAYROLL_ADJUSTMENT" &&
			 (day.status === "APPROVED" || day.status === "LOCKED") ? (  
			<button
                            type="button"
                            disabled={loading || !calc || payCents <= 0}
   			    onClick={() => payNowForDay(date, day)}
                            style={{
  marginTop: 4,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #86efac",
  background: "#ecfdf5",
  color: "#065f46",
  fontSize: 12,
  fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer",
  opacity: loading || !calc || payCents <= 0 ? 0.6 : 1,
}}
			  >
                            Pay Now
                          </button>
                        ) : null}

{day.paidNow ? (
  <div
  style={{
  marginTop: 4,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
}}
  >
    Paid Now ${(Number(day.paidNowAmountCents || 0) / 100).toFixed(2)}
    {day.paidNowAt ? (
      <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
        {new Date(day.paidNowAt).toLocaleString()}
      </div>
    ) : null}
  </div>
) : day.paidViaPayrollWeek ? (
  <div
   style={{
  marginTop: 4,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
}}
  >
    Included in finalized payroll
  </div>
) : day.addedAfterFinalizedWeek ? (
  <div
    style={{
  marginTop: 4,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #fcd34d",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
}}
  >
    Added after payroll finalized
  </div>
) : null}
                          {rateWarning ? (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        lineHeight: 1.3,
        color: "#b45309",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
        padding: "4px 6px",
        maxWidth: 130,
        whiteSpace: "normal",
      }}
    >
      {rateWarning}
    </div>
  ) : null}
		        </div>

                      <select
                        disabled={isApprovedOrLocked(day)}
                        value={day.facilityId}
                        onChange={(e) => {
                          const nextDay = { ...day, facilityId: e.target.value };
                          updateDay(activeEmpId, date, { facilityId: e.target.value });
                          scheduleCalc(activeEmpId, date, nextDay);
                        }}
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			>
                        <option value="">Select facility</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>

                      <select
                        disabled={isApprovedOrLocked(day)}
                        value={day.shiftType}
                        onChange={(e) => {
                          const nextDay = { ...day, shiftType: e.target.value };
                          updateDay(activeEmpId, date, { shiftType: e.target.value });
                          scheduleCalc(activeEmpId, date, nextDay);
                        }}
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                        <option value="NOC">NOC</option>
                        <option value="AM+PM">AM+PM</option>
                        <option value="PM+NOC">PM+NOC</option>
                        <option value="NOC+AM">NOC+AM</option>
                      </select>

                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.p1.clockIn}
                        onChange={(e) => updateDayPunch(activeEmpId, date, "p1", "clockIn", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="e.g. 07:00 or 13:00"
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.b1.startTime}
                        onChange={(e) => updateDayBreak(activeEmpId, date, "b1", "startTime", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.b1.endTime}
                        onChange={(e) => updateDayBreak(activeEmpId, date, "b1", "endTime", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.p1.clockOut}
                        onChange={(e) => updateDayPunch(activeEmpId, date, "p1", "clockOut", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="e.g. 15:30"
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>

                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.p2.clockIn}
                        onChange={(e) => updateDayPunch(activeEmpId, date, "p2", "clockIn", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                      style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.b2.startTime}
                        onChange={(e) => updateDayBreak(activeEmpId, date, "b2", "startTime", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                         style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.b2.endTime}
                        onChange={(e) => updateDayBreak(activeEmpId, date, "b2", "endTime", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                        style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>
                      <input
                        disabled={isApprovedOrLocked(day)}
                        value={day.p2.clockOut}
                        onChange={(e) => updateDayPunch(activeEmpId, date, "p2", "clockOut", e.target.value)}
                        onBlur={() => normalizeTimesOnBlur(activeEmpId, date)}
                        placeholder="(optional)"
                        style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			/>

                      <div
                       style={{
  border: isHoliday ? "1px solid #f59e0b" : "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
  fontSize: 12,
  lineHeight: 1.35,
  background: isHoliday ? "#fffaf0" : "#f8fafc",
  minWidth: 260,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
		      >
                        {!calc ? (
                        <div style={{ color: "#64748b" }}>—</div>
			) : (
                          <>
                            <div style={{ color: "#0f172a" }}>
  <b>Payable:</b> {calc.display.calculatedHours_decimal.toFixed(2)}
</div>
                            <div style={{ marginTop: 4, color: "#334155" }}>
			    <b>Reg:</b> {calc.buckets.regular_decimal.toFixed(2)}
			    <b>OT:</b> {calc.buckets.overtime_decimal.toFixed(2)}
			    <b>DT:</b> {calc.buckets.double_decimal.toFixed(2)}
			    </div>
			    {activeEmp ? (
    <div style={{ marginTop: 4, color: "#0f172a", fontWeight: 700 }}>
    <b>Amount:</b>{" "}
    {(payCents / 100).toFixed(2)}
  </div>
) : null}

<div
style={{
  marginTop: 8,
  paddingTop: 8,
  borderTop: "1px solid #e2e8f0",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#334155",
}}
>
<div style={{ fontWeight: 800, marginBottom: 4, color: "#0f172a" }}>Employee Pay</div>
  {isHoliday ? (
    <div
      style={{
        marginBottom: 6,
        color: "#92400e",
        fontWeight: 700,
      }}
    >
      🎉 {holidayName || "Holiday"} — Regular hours @ {formatMultiplier(payBreakdown.regularMultiplier)}
    </div>
  ) : null}

  <div>
    <b>Reg:</b>{" "}
    {payBreakdown.regularHours.toFixed(2)}h × {formatMultiplier(payBreakdown.regularMultiplier)} ={" "}
    {money(payBreakdown.regularPayCents)}
  </div>

  <div>
    <b>OT:</b>{" "}
    {payBreakdown.overtimeHours.toFixed(2)}h × {formatMultiplier(payBreakdown.overtimeMultiplier)} ={" "}
    {money(payBreakdown.overtimePayCents)}
  </div>

  <div>
    <b>DT:</b>{" "}
    {payBreakdown.doubleHours.toFixed(2)}h × {formatMultiplier(payBreakdown.doubleMultiplier)} ={" "}
    {money(payBreakdown.doublePayCents)}
  </div>

  <div style={{ marginTop: 4, fontWeight: 700 }}>
    Total Pay: {money(payBreakdown.totalPayCents)}
  </div>
</div>

<div
  style={{
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid #d1d5db",
    fontSize: 11,
    lineHeight: 1.5,
  }}
>
<div style={{ fontWeight: 800, marginBottom: 4, color: "#0f172a" }}>Client Billing</div>
  {billingBreakdown.hasRate ? (
    <>
      <div>
        <b>Reg:</b>{" "}
        {billingBreakdown.regularHours.toFixed(2)}h ×{" "}
        {formatMultiplier(billingBreakdown.regularMultiplier)} ={" "}
        {money(billingBreakdown.regularBillCents)}
      </div>

      <div>
        <b>OT:</b>{" "}
        {billingBreakdown.overtimeHours.toFixed(2)}h ×{" "}
        {formatMultiplier(billingBreakdown.overtimeMultiplier)} ={" "}
        {money(billingBreakdown.overtimeBillCents)}
      </div>

      <div>
        <b>DT:</b>{" "}
        {billingBreakdown.doubleHours.toFixed(2)}h ×{" "}
        {formatMultiplier(billingBreakdown.doubleMultiplier)} ={" "}
        {money(billingBreakdown.doubleBillCents)}
      </div>

      <div style={{ marginTop: 4, fontWeight: 700 }}>
        Total Bill: {money(billingBreakdown.totalBillCents)}
      </div>

      <div
        style={{
          marginTop: 4,
          fontWeight: 700,
          color: marginCents < 0 ? "#b91c1c" : "#166534",
        }}
      >
        Margin: {money(marginCents)}
      </div>
    </>
  ) : (
    <div style={{ color: "#92400e", fontWeight: 700, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 8px", display: "inline-block" }}>  
	Missing billing rate
    </div>
  )}
</div>
                            {Array.isArray(calc.warnings) && calc.warnings.length > 0 ? (
                                <div
  style={{
    marginTop: 8,
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "8px 10px",
  }}
>
				{calc.warnings.map((w, i) => (
                                  <div key={i}>⚠ {w}</div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

        {ok ? (
  <div
    style={{
      marginTop: 12,
      color: "#166534",
      fontSize: 13,
      background: "#f0fdf4",
      border: "1px solid #86efac",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {ok}
  </div>
) : null}
  
        {err ? (
  <div
    style={{
      marginTop: 12,
      color: "#b91c1c",
      fontSize: 13,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {err}
  </div>
) : null}
	</div>
      ) : (
	<div
  style={{
    marginTop: 16,
    color: "#64748b",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "18px 20px",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>          

		{props?.lockEmployeeTabs ? "Loading entry…" : "Select employees and open tabs."}
        </div>
      )}
    </div>
  );
}
