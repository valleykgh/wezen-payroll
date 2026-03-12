"use client";

import React, { useEffect, useMemo, useState } from "react";
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

type PunchSet = {
  clockIn: string;
  clockOut: string;
};

type BreakSet = {
  startTime: string;
  endTime: string;
};

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
  warnings?: string[];
};

function money(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function normalizeTimeInput(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";

  if (/[ap]\.?m\.?/i.test(s)) {
    return s
      .replace(/\s+/g, " ")
      .replace(/\bA\.?M\.?\b/i, "AM")
      .replace(/\bP\.?M\.?\b/i, "PM")
      .trim();
  }

  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;

  let hh = Number(m[1]);
  const mm = m[2];

  if (Number.isNaN(hh) || hh < 0 || hh > 23) return s;

  const ampm = hh >= 12 ? "PM" : "AM";
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;

  return `${h12}:${mm} ${ampm}`;
}

export default function AdminMissedTimePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [shiftType, setShiftType] = useState("AM");
  const [note, setNote] = useState("");

  const [p1, setP1] = useState<PunchSet>({ clockIn: "", clockOut: "" });
  const [p2, setP2] = useState<PunchSet>({ clockIn: "", clockOut: "" });
  const [b1, setB1] = useState<BreakSet>({ startTime: "", endTime: "" });
  const [b2, setB2] = useState<BreakSet>({ startTime: "", endTime: "" });

  const [calc, setCalc] = useState<CalcResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [empResp, facResp] = await Promise.all([
          apiFetch<{ employees: Employee[] }>("/api/admin/employees"),
          apiFetch<{ facilities: Facility[] }>("/api/admin/facilities"),
        ]);

        setEmployees((empResp.employees || []).filter((e) => e.active));
        setFacilities(facResp.facilities || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === facilityId) || null,
    [facilities, facilityId]
  );

  const computedAmountCents = useMemo(() => {
    if (!selectedEmployee || !calc) return 0;

    const rate = Number(selectedEmployee.hourlyRateCents || 0);
    const regPay = Math.round(Number(calc.buckets.regular_decimal || 0) * rate);
    const otPay = Math.round(Number(calc.buckets.overtime_decimal || 0) * rate * 1.5);
    const dtPay = Math.round(Number(calc.buckets.double_decimal || 0) * rate * 2);

    return regPay + otPay + dtPay;
  }, [selectedEmployee, calc]);

  function buildReason() {
    const base = workDate ? `Missed shift for ${workDate}` : "Missed shift";
    const facilityPart = selectedFacility ? ` at ${selectedFacility.name}` : "";
    const notePart = note.trim() ? ` — ${note.trim()}` : "";
    return `${base}${facilityPart}${notePart}`;
  }

  function buildPunches() {
    return [p1, p2]
      .filter((p) => String(p.clockIn || "").trim() && String(p.clockOut || "").trim())
      .map((p) => ({
        clockIn: normalizeTimeInput(String(p.clockIn || "").trim()),
        clockOut: normalizeTimeInput(String(p.clockOut || "").trim()),
      }));
  }

  function buildBreaks() {
    return [b1, b2]
      .filter((b) => String(b.startTime || "").trim() && String(b.endTime || "").trim())
      .map((b) => ({
        startTime: normalizeTimeInput(String(b.startTime || "").trim()),
        endTime: normalizeTimeInput(String(b.endTime || "").trim()),
      }));
  }

  async function calculate() {
    setErr("");
    setOk("");
    setCalc(null);

    if (!employeeId) {
      setErr("Please select an employee.");
      return;
    }
    if (!facilityId) {
      setErr("Please select a facility.");
      return;
    }
    if (!workDate) {
      setErr("Please select the missed shift date.");
      return;
    }

    const punches = buildPunches();
    if (punches.length === 0) {
      setErr("Please enter at least one Clock In and Clock Out.");
      return;
    }

    const breaks = buildBreaks();

    setCalculating(true);
    try {
      const qs = new URLSearchParams();
      qs.set("workDate", workDate);
      qs.set("shiftType", shiftType);
      qs.set("punches", JSON.stringify(punches));
      qs.set("breaks", JSON.stringify(breaks));

      const resp = await apiFetch<CalcResp>(`/api/admin/time-entry/calc?${qs.toString()}`);
      setCalc(resp);
    } catch (e: any) {
      setErr(e?.message || "Failed to calculate missed time");
    } finally {
      setCalculating(false);
    }
  }

  async function createAdjustment() {
    setErr("");
    setOk("");

    if (!selectedEmployee) {
      setErr("Please select an employee.");
      return;
    }
    if (!facilityId) {
      setErr("Please select a facility.");
      return;
    }
    if (!workDate) {
      setErr("Please select the missed shift date.");
      return;
    }
    if (!calc) {
      setErr("Please calculate the missed time first.");
      return;
    }

    if (!Number.isFinite(computedAmountCents) || computedAmountCents <= 0) {
      setErr("Calculated amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/admin/payroll-adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          reason: buildReason(),
          amountCents: computedAmountCents,
        }),
      });

      setOk(`Adjustment created for ${selectedEmployee.legalName}: ${money(computedAmountCents)}.`);

      setEmployeeId("");
      setFacilityId("");
      setWorkDate("");
      setShiftType("AM");
      setNote("");
      setP1({ clockIn: "", clockOut: "" });
      setP2({ clockIn: "", clockOut: "" });
      setB1({ startTime: "", endTime: "" });
      setB2({ startTime: "", endTime: "" });
      setCalc(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to create payroll adjustment");
    } finally {
      setSaving(false);
    }
  }

  const disabled = loading || calculating || saving;

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Missed Time Entry</h1>
      <div style={{ color: "#666", marginTop: 6 }}>
        Use this after a payroll week is locked. Enter punches, calculate payable hours, then create a payroll adjustment.
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 180px 160px",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Employee</div>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={disabled}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.legalName} ({emp.email}){emp.title ? ` — ${emp.title}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Facility</div>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              disabled={disabled}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="">Select facility</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Work Date</div>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              disabled={disabled}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift Type</div>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              disabled={disabled}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="NOC">NOC</option>
              <option value="AM+PM">AM+PM</option>
              <option value="PM+NOC">PM+NOC</option>
              <option value="NOC+AM">NOC+AM</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 18, fontWeight: 700 }}>Punches</div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 1 — Clock In</div>
            <input
              value={p1.clockIn}
              onChange={(e) => setP1((prev) => ({ ...prev, clockIn: e.target.value }))}
              disabled={disabled}
              placeholder="e.g. 07:00 or 7:00 AM"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 1 — Meal Out</div>
            <input
              value={b1.startTime}
              onChange={(e) => setB1((prev) => ({ ...prev, startTime: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 1 — Meal In</div>
            <input
              value={b1.endTime}
              onChange={(e) => setB1((prev) => ({ ...prev, endTime: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 1 — Clock Out</div>
            <input
              value={p1.clockOut}
              onChange={(e) => setP1((prev) => ({ ...prev, clockOut: e.target.value }))}
              disabled={disabled}
              placeholder="e.g. 15:30 or 3:30 PM"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 2 — Clock In</div>
            <input
              value={p2.clockIn}
              onChange={(e) => setP2((prev) => ({ ...prev, clockIn: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 2 — Meal Out</div>
            <input
              value={b2.startTime}
              onChange={(e) => setB2((prev) => ({ ...prev, startTime: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 2 — Meal In</div>
            <input
              value={b2.endTime}
              onChange={(e) => setB2((prev) => ({ ...prev, endTime: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Shift 2 — Clock Out</div>
            <input
              value={p2.clockOut}
              onChange={(e) => setP2((prev) => ({ ...prev, clockOut: e.target.value }))}
              disabled={disabled}
              placeholder="optional"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Optional Note</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled}
            placeholder="e.g. entered after payroll lock"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={calculate}
            disabled={disabled}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {calculating ? "Calculating..." : "Calculate"}
          </button>

          <button
            type="button"
            onClick={createAdjustment}
            disabled={disabled || !calc}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #1d4ed8",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 700,
            }}
          >
            {saving ? "Creating..." : "Create Payroll Adjustment"}
          </button>
        </div>

        {calc ? (
          <div
            style={{
              marginTop: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 14,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Calculated Result</div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              <div>
                Payable Hours: <b>{calc.display.totalHours_HHMM}</b> ({calc.display.calculatedHours_decimal})
              </div>
              <div>
                Reg: <b>{calc.buckets.regular_HHMM}</b>
              </div>
              <div>
                OT: <b>{calc.buckets.overtime_HHMM}</b>
              </div>
              <div>
                DT: <b>{calc.buckets.double_HHMM}</b>
              </div>
              <div>
                Estimated Pay: <b>{money(computedAmountCents)}</b>
              </div>
            </div>

            {Array.isArray(calc.warnings) && calc.warnings.length > 0 ? (
              <div style={{ marginTop: 10, color: "#b00020", fontSize: 13 }}>
                {calc.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Reason to be saved: <b>{buildReason()}</b>
            </div>
          </div>
        ) : null}

        {ok ? <div style={{ marginTop: 12, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
        {err ? <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>{err}</div> : null}
      </div>
    </div>
  );
}
