"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";

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

function normalizeOnBlur(value: string): string {
  if (!value) return "";
  return normalizeTimeInput(value);
}

  function ExceptionSection({
  title,
  tone,
  rows,
  onAddToSupplemental,
  selectedRows,
  setSelectedRows,
}: {
  title: string;
  tone: "orange" | "blue" | "red" | "purple";
  rows: any[];
  onAddToSupplemental: (row: any) => Promise<void>;
  selectedRows: any[];
  setSelectedRows: React.Dispatch<React.SetStateAction<any[]>>;
}) {

  const tones = {
    orange: {
      headerBg: "#fff7ed",
      headerBorder: "#fdba74",
      headerText: "#9a3412",
    },
    blue: {
      headerBg: "#eff6ff",
      headerBorder: "#93c5fd",
      headerText: "#1d4ed8",
    },
    red: {
      headerBg: "#fef2f2",
      headerBorder: "#fca5a5",
      headerText: "#b91c1c",
    },
    purple: {
      headerBg: "#f5f3ff",
      headerBorder: "#c4b5fd",
      headerText: "#6d28d9",
    },
  }[tone];

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${tones.headerBorder}`,
          background: tones.headerBg,
          color: tones.headerText,
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {title} ({rows.length})
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>✔</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Date</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Employee</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Facility</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Type</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Billed</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Invoice</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, color: "#6b7280" }}>
                  No items in this section.
                </td>
              </tr>
            ) : (
              rows.map((row: any, idx: number) => (
                <tr key={`${title}-${row.sourceType || "ROW"}-${row.sourceId || idx}`}>
                 <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
     		 <input
       		 type="checkbox"
       		checked={selectedRows.some(
 		 (r) =>
   		 String(r.sourceType) === String(row.sourceType) &&
   		 String(r.sourceId) === String(row.sourceId)
		)} 
		onChange={(e) => {
         	 if (e.target.checked) {
         	   setSelectedRows((prev) => {
			if (prev.some((r) => String(r.sourceType) === String(row.sourceType) && String(r.sourceId) === String(row.sourceId))) {
			   return prev;
			}
			return [...prev, row];
			});   
         	 } else {
           	 setSelectedRows((prev) =>
             	 prev.filter((r) => String(r.sourceType) == String(row.sourceType) && String(r.sourceId) === String(row.sourceId))
         	   );
         	 }
       		 }}
     		 />
    		</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.workDate ? new Date(row.workDate).toISOString().slice(0, 10) : "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.employee?.legalName || row.employeeName || row.employeeId || "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.facility?.name || row.facilityName || row.facilityId || "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.sourceType || (row.payrollRunId ? "TIME_ENTRY" : "ENTRY")}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.billedAt ? "Yes" : "No"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {row.invoiceType || "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {!row.billedAt ? (
                      <button
                        type="button"
                        onClick={() => onAddToSupplemental(row)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Add to Supplemental
                      </button>
                    ) : (
                      <span style={{ color: "#6b7280" }}>Already billed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function groupRowsByFacility(rows: any[]) {
  const map = new Map<string, any[]>();

  for (const row of rows || []) {
    const facilityId = String(row.facilityId || "");
    if (!facilityId) continue;

    const existing = map.get(facilityId) || [];
    existing.push(row);
    map.set(facilityId, existing);
  }

  return Array.from(map.entries()).map(([facilityId, facilityRows]) => ({
    facilityId,
    rows: facilityRows,
  }));
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


  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exceptions, setExceptions] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [activeExceptionTab, setActiveExceptionTab] = useState<
  "afterFinalized" | "needsSupplemental" | "unpaid" | "adjustments"
>("needsSupplemental");

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

     function validateShiftTypeAgainstPunches() {
    const hasFirstShift =
      String(p1.clockIn || "").trim() && String(p1.clockOut || "").trim();

    const hasSecondShift =
      String(p2.clockIn || "").trim() && String(p2.clockOut || "").trim();

    const isCombinedShift =
      shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM";

    if (hasSecondShift && !isCombinedShift) {
      return "You entered punches for two shifts. Please select a combined Shift Type (AM+PM, PM+NOC, or NOC+AM).";
    }

    if (!hasSecondShift && isCombinedShift) {
      return "You selected a combined Shift Type, but only entered one shift. Please enter the second shift punches or change the Shift Type.";
    }

    return "";
  }
async function loadExceptions() {
  setErr("");
  setOk("");
  if (!from || !to) {
    setErr("Select From and To dates first.");
    return;
  }

  try {

    const qs = new URLSearchParams({ from, to });
if (facilityId) qs.set("facilityId", facilityId);

    const resp = await apiFetch(`/api/admin/exceptions?${qs.toString()}`);
    setExceptions(resp);
  } catch (e: any) {
    setErr(e?.message || "Failed to load exceptions");
  }
}

async function handleAddToSupplemental(row: any) {
  try {
    setErr("");
    setOk("");
    const effectiveFacilityId = facilityId || String(row.facilityId || "");
if (!effectiveFacilityId) {
  setErr("No facility found for this row.");
  return;
}
    if (!from || !to) {
      setErr("Select From and To first.");
      return;
    }

    const invoiceNo = window.prompt("Enter supplemental invoice number", "2001-A");
    if (!invoiceNo) return;

    const qs = new URLSearchParams({
      facilityId,
      from,
      to,
      mode: "supplemental",
      invoiceNumber: invoiceNo,
      employeeIds: String(row.employeeId || ""),
    });

    const resp = await fetch(`/api/admin/billing-export?${qs.toString()}`, {
      headers: {
      Authorization: `Bearer ${getToken() || ""}`,
      },
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      setErr(body?.error || "Failed to export supplemental invoice");
      return;
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplemental-${row.employeeId || "row"}-${from}-to-${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    await loadExceptions();
    setOk(`Supplemental invoice exported for ${row.employee?.legalName || row.employeeId}.`);
  } catch (e: any) {
    setErr(e?.message || "Failed to add to supplemental invoice");
  }
}

async function handleBulkSupplemental() {
  try {
    setErr("");
    setOk("");

    if (selectedRows.length === 0) {
      setErr("No rows selected.");
      return;
    }

    if (!from || !to) {
      setErr("Select From and To first.");
      return;
    }

    const invoiceNo = window.prompt("Enter supplemental invoice number", "2001-A");
    if (!invoiceNo) return;

    const employeeIds = Array.from(
      new Set(selectedRows.map((r) => String(r.employeeId)))
    );

    const effectiveFacilityId = facilityId || String(selectedRows[0]?.facilityId || "");
    if (!effectiveFacilityId) {
      setErr("No facility found for selected rows.");
      return;
    }

    const qs = new URLSearchParams({
      facilityId: effectiveFacilityId,
      from,
      to,
      mode: "supplemental",
      invoiceNumber: invoiceNo,
      employeeIds: employeeIds.join(","),
    });

    const resp = await fetch(`/api/admin/billing-export?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${getToken() || ""}`,
      },
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      setErr(body?.error || "Bulk supplemental export failed");
      return;
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `supplemental-bulk-${from}-to-${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    setSelectedRows([]);
    await loadExceptions();
    setOk("Bulk supplemental invoice exported successfully.");
  } catch (e: any) {
    setErr(e?.message || "Bulk supplemental export failed");
  }
}

async function handleFixAllExceptions() {
  try {
    setErr("");
    setOk("");

    if (!exceptions?.needsSupplemental || exceptions.needsSupplemental.length === 0) {
      setErr("No supplemental exceptions found.");
      return;
    }

    if (!from || !to) {
      setErr("Select From and To first.");
      return;
    }

    const invoicePrefix = window.prompt(
      "Enter supplemental invoice base number (example: 2001-A)",
      "2001-A"
    );
    if (!invoicePrefix) return;

    const grouped = groupRowsByFacility(exceptions.needsSupplemental);
    if (grouped.length === 0) {
      setErr("No facility-grouped supplemental exceptions found.");
      return;
    }

    const token = getToken();
    if (!token) {
      setErr("Missing token. Please log in again.");
      return;
    }

    let exportCount = 0;

    for (let i = 0; i < grouped.length; i++) {
      const group = grouped[i];
      const employeeIds = Array.from(
        new Set(group.rows.map((r: any) => String(r.employeeId || "")).filter(Boolean))
      );

      if (!group.facilityId || employeeIds.length === 0) continue;

      const invoiceNumber =
        grouped.length === 1 ? invoicePrefix : `${invoicePrefix}-${i + 1}`;

      const qs = new URLSearchParams({
        facilityId: group.facilityId,
        from,
        to,
        mode: "supplemental",
        invoiceNumber,
        employeeIds: employeeIds.join(","),
      });

      const resp = await fetch(`/api/admin/billing-export?${qs.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        setErr(
          body?.error ||
            `Failed to export supplemental invoice for facility ${group.facilityId}`
        );
        return;
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `supplemental-${group.facilityId}-${from}-to-${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      exportCount += 1;
    }

    setSelectedRows([]);
    await loadExceptions();
    setOk(`Created ${exportCount} supplemental invoice export(s).`);
  } catch (e: any) {
    setErr(e?.message || "Failed to fix all exceptions");
  }
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
        const shiftValidationErr = validateShiftTypeAgainstPunches();
    if (shiftValidationErr) {
      setErr(shiftValidationErr);
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
        const shiftValidationErr = validateShiftTypeAgainstPunches();
    if (shiftValidationErr) {
      setErr(shiftValidationErr);
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
    facilityId,
    workDate,
    shiftType,
    punchesJson: buildPunches(),
    breaksJson: buildBreaks(),
    hours: Number(calc.display.calculatedHours_decimal || 0),
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
      <h1 style={{ fontSize: 24, margin: 0 }}>Exceptions Dashboard</h1>
      <div style={{ color: "#666", marginTop: 6 }}>
      Review missing time, post-payroll entries, supplemental billing candidates, and payroll adjustments.
      </div>

      <div
  style={{
    marginTop: 16,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "end",
  }}
>
  <div>
    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>From</div>
    <input
      type="date"
      value={from}
      onChange={(e) => setFrom(e.target.value)}
      style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
    />
  </div>

  <div>
    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>To</div>
    <input
      type="date"
      value={to}
      onChange={(e) => setTo(e.target.value)}
      style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
    />
  </div>

  <div>
    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Facility Filter</div>
    <select
      value={facilityId}
      onChange={(e) => setFacilityId(e.target.value)}
      style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8, minWidth: 220 }}
    >
      <option value="">All Facilities</option>
      {facilities.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  </div>

  <button
    onClick={loadExceptions}
    style={{
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#fef2f2",
      color: "#dc2626",
      fontWeight: 700,
      height: 44,
    }}
  >
    Load Exceptions
  </button>
</div>

{selectedRows.length > 0 && (
  <div
    style={{
      marginTop: 12,
      padding: "10px 14px",
      borderRadius: 10,
      background: "#ecfdf5",
      border: "1px solid #86efac",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <div style={{ fontWeight: 700 }}>
      {selectedRows.length} selected
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={handleBulkSupplemental}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #1d4ed8",
          background: "#eff6ff",
          color: "#1d4ed8",
          fontWeight: 700,
        }}
      >
        Add Selected to Supplemental
      </button>

      <button
        onClick={() => setSelectedRows([])}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          background: "#fff",
        }}
      >
        Clear
      </button>
    </div>
  </div>
)}

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
	      onBlur={(e) =>
  setP1((prev) => ({
    ...prev,
    clockIn: normalizeOnBlur(e.target.value),
  }))
}
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
	      onBlur={(e) =>
  setB1((prev) => ({
    ...prev,
    startTime: normalizeOnBlur(e.target.value),
  }))
}
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
	      onBlur={(e) =>
  setB1((prev) => ({
    ...prev,
    endTime: normalizeOnBlur(e.target.value),
  }))
}
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
	      onBlur={(e) =>
  setP1((prev) => ({
    ...prev,
    clockOut: normalizeOnBlur(e.target.value),
  }))
}
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
	      onBlur={(e) =>
  setP2((prev) => ({
    ...prev,
    clockIn: normalizeOnBlur(e.target.value),
  }))
}
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
              onBlur={(e) =>
  setB2((prev) => ({
    ...prev,
    startTime: normalizeOnBlur(e.target.value),
  }))
}
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
              onBlur={(e) =>
  setB2((prev) => ({
    ...prev,
    endTime: normalizeOnBlur(e.target.value),
  }))
}
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
              onBlur={(e) =>
  setP2((prev) => ({
    ...prev,
    clockOut: normalizeOnBlur(e.target.value),
  }))
}
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
              <b>Payable:</b> {calc.display.calculatedHours_decimal.toFixed(2)}
              </div>
              <div>
              <b>Reg:</b> {calc.buckets.regular_decimal.toFixed(2)}
	      </div>
              <div>
              <b>OT:</b> {calc.buckets.overtime_decimal.toFixed(2)}
	      </div>
              <div>
              <b>DT:</b> {calc.buckets.double_decimal.toFixed(2)}
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


{exceptions ? (
  <div style={{ marginTop: 20 }}>

     <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  }}
>
  <h2 style={{ margin: 0 }}>🚨 Exceptions Dashboard</h2>

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    <button
      type="button"
      onClick={loadExceptions}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #111827",
        background: "#111827",
        color: "#ffffff",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Refresh Exceptions
    </button>

  <button
    type="button"
    onClick={handleFixAllExceptions}
    disabled={!exceptions?.needsSupplemental?.length}
    style={{
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #065f46",
      background: "#ecfdf5",
      color: "#065f46",
      fontWeight: 700,
      cursor: !exceptions?.needsSupplemental?.length ? "not-allowed" : "pointer",
      opacity: !exceptions?.needsSupplemental?.length ? 0.5 : 1,
    }}
  >
    Fix All Exceptions
  </button>
      
      {selectedRows.length > 0 ? (
      <button
        type="button"
        onClick={handleBulkSupplemental}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #2563eb",
          background: "#eff6ff",
          color: "#1d4ed8",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Export Selected ({selectedRows.length})
      </button>
    ) : null} 
  </div>
</div>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 16,
  }}
>
  <button
    type="button"
    onClick={() => setActiveExceptionTab("afterFinalized")}
    style={{
      textAlign: "left",
      padding: "14px 16px",
      borderRadius: 12,
      border:
        activeExceptionTab === "afterFinalized"
          ? "2px solid #f97316"
          : "1px solid #fdba74",
      background: "#fff7ed",
      color: "#9a3412",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
      After Finalized
    </div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>
      {exceptions.addedAfterFinalized.length}
    </div>
  </button>

  <button
    type="button"
    onClick={() => setActiveExceptionTab("needsSupplemental")}
    style={{
      textAlign: "left",
      padding: "14px 16px",
      borderRadius: 12,
      border:
        activeExceptionTab === "needsSupplemental"
          ? "2px solid #2563eb"
          : "1px solid #93c5fd",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
      Needs Supplemental
    </div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>
      {exceptions.needsSupplemental.length}
    </div>
  </button>

  <button
    type="button"
    onClick={() => setActiveExceptionTab("unpaid")}
    style={{
      textAlign: "left",
      padding: "14px 16px",
      borderRadius: 12,
      border:
        activeExceptionTab === "unpaid"
          ? "2px solid #dc2626"
          : "1px solid #fca5a5",
      background: "#fef2f2",
      color: "#b91c1c",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
      Unpaid
    </div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>
      {exceptions.unpaid.length}
    </div>
  </button>

  <button
    type="button"
    onClick={() => setActiveExceptionTab("adjustments")}
    style={{
      textAlign: "left",
      padding: "14px 16px",
      borderRadius: 12,
      border:
        activeExceptionTab === "adjustments"
          ? "2px solid #7c3aed"
          : "1px solid #c4b5fd",
      background: "#f5f3ff",
      color: "#6d28d9",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
      Adjustments
    </div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>
      {exceptions.adjustments.length}
    </div>
  </button>
</div>
 
    
{activeExceptionTab === "afterFinalized" ? (
  <ExceptionSection
    title="Added After Payroll Finalized"
    tone="orange"
    rows={exceptions.addedAfterFinalized || []}
    onAddToSupplemental={handleAddToSupplemental}
    selectedRows={selectedRows}
    setSelectedRows={setSelectedRows}
  />
) : null}

{activeExceptionTab === "needsSupplemental" ? (
  <ExceptionSection
    title="Needs Supplemental Billing"
    tone="blue"
    rows={exceptions.needsSupplemental || []}
    onAddToSupplemental={handleAddToSupplemental}
    selectedRows={selectedRows}
    setSelectedRows={setSelectedRows}
  />
) : null}

{activeExceptionTab === "unpaid" ? (
  <ExceptionSection
    title="Unpaid Entries"
    tone="red"
    rows={exceptions.unpaid || []}
    onAddToSupplemental={handleAddToSupplemental}
    selectedRows={selectedRows}
    setSelectedRows={setSelectedRows}
  />
) : null}

{activeExceptionTab === "adjustments" ? (
  <ExceptionSection
    title="Payroll Adjustments"
    tone="purple"
    rows={exceptions.adjustments || []}
    onAddToSupplemental={handleAddToSupplemental}
    selectedRows={selectedRows}
    setSelectedRows={setSelectedRows}
  />
) : null}
  </div>
) : null}
        {ok ? <div style={{ marginTop: 12, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
        {err ? <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>{err}</div> : null}
      </div>
    </div>
  );
}
