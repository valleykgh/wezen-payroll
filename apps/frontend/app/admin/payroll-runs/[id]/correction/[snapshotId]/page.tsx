"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";

type SnapshotResp = {
  snapshot: {
    id: string;
    payrollRunId: string;
    employeeId: string;
    workDate: string;
    status: string;
    snapshotJson: any;
    employee?: {
      id: string;
      legalName: string;
      preferredName?: string | null;
      email?: string | null;
    } | null;
    payrollRun?: {
      id: string;
      periodStart: string;
      periodEnd: string;
      status: string;
    } | null;
  };
};

type CalcResp = {
  input: {
    workDate: string;
    shiftType: string;
    workedMinutes: number;
    breakMinutes: number;
    payableMinutes: number;
  };
  buckets: {
    regularMinutes: number;
    overtimeMinutes: number;
    doubleMinutes: number;
    regular_HHMM: string;
    overtime_HHMM: string;
    double_HHMM: string;
  };
  pay: {
    hourlyRateCents: number;
    regularPayCents: number;
    overtimePayCents: number;
    doublePayCents: number;
    grossPayCents: number;
  };
  display: {
    payableHours_HHMM: string;
  };
};

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

  if (Number.isNaN(hh)) return s;
  if (hh < 0 || hh > 23) return s;

  const ampm = hh >= 12 ? "PM" : "AM";
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${ampm}`;
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.floor(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function dollars(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dateOnly(v?: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

function employeeLabel(emp?: SnapshotResp["snapshot"]["employee"] | null) {
  if (!emp) return "Unknown";
  return emp.preferredName ? `${emp.legalName} (${emp.preferredName})` : emp.legalName;
}

function toDisplayTime(v?: string | null): string {
  const s = String(v || "").trim();
  if (!s) return "";

  if (/[ap]\.?m\.?/i.test(s) || /^\d{1,2}:\d{2}$/.test(s)) {
    return normalizeTimeInput(s);
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  return `${h}:${m} ${ap}`;
}

export default function PayrollCorrectionPage() {
  const params = useParams<{ id: string; snapshotId: string }>();
  const runId = String(params?.id || "");
  const snapshotId = String(params?.snapshotId || "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [snapshot, setSnapshot] = useState<SnapshotResp["snapshot"] | null>(null);
  const [calc, setCalc] = useState<CalcResp | null>(null);
  const [calcErr, setCalcErr] = useState("");

  const [shiftType, setShiftType] = useState("AM");

  const [p1In, setP1In] = useState("");
  const [p1Out, setP1Out] = useState("");
  const [p2In, setP2In] = useState("");
  const [p2Out, setP2Out] = useState("");

  const [b1Start, setB1Start] = useState("");
  const [b1End, setB1End] = useState("");
  const [b2Start, setB2Start] = useState("");
  const [b2End, setB2End] = useState("");

  const [reason, setReason] = useState("");
  const [creatingAdjustment, setCreatingAdjustment] = useState(false);

  async function loadSnapshot() {
  if (!runId || !snapshotId) {
    setErr("Missing correction route parameters.");
    setLoading(false);
    return;
  }

  setLoading(true);
  setErr("");

  try {
    const data = await apiFetch<SnapshotResp>(
      `/api/admin/payroll-runs/${runId}/snapshots/${snapshotId}`
    );

    const s = data.snapshot;
    const j = s.snapshotJson || {};
    const punches = Array.isArray(j.punchesJson) ? j.punchesJson : [];
    const breaks = Array.isArray(j.breaksJson) ? j.breaksJson : [];

    setSnapshot(s);
    setShiftType(j.shiftType || "AM");

    setP1In(toDisplayTime(punches[0]?.clockIn));
    setP1Out(toDisplayTime(punches[0]?.clockOut));
    setP2In(toDisplayTime(punches[1]?.clockIn));
    setP2Out(toDisplayTime(punches[1]?.clockOut));

    setB1Start(toDisplayTime(breaks[0]?.startTime));
    setB1End(toDisplayTime(breaks[0]?.endTime));
    setB2Start(toDisplayTime(breaks[1]?.startTime));
    setB2End(toDisplayTime(breaks[1]?.endTime));

    setReason(
      `Correction from payroll snapshot • ${dateOnly(s.workDate)} • shift ${j.shiftType || "-"}${
        j.facilityName ? ` • at ${j.facilityName}` : ""
      }`
    );
  } catch (e: any) {
    setErr(e?.message || "Failed to load correction snapshot");
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, snapshotId]);

  const workDate = dateOnly(snapshot?.workDate);

  const correctedPayload = useMemo(() => {
    const punches = [
      { clockIn: normalizeTimeInput(p1In), clockOut: normalizeTimeInput(p1Out) },
      { clockIn: normalizeTimeInput(p2In), clockOut: normalizeTimeInput(p2Out) },
    ].filter((p) => p.clockIn && p.clockOut);

    const breaks = [
      { startTime: normalizeTimeInput(b1Start), endTime: normalizeTimeInput(b1End) },
      { startTime: normalizeTimeInput(b2Start), endTime: normalizeTimeInput(b2End) },
    ].filter((b) => b.startTime && b.endTime);

    return { punches, breaks };
  }, [p1In, p1Out, p2In, p2Out, b1Start, b1End, b2Start, b2End]);

  async function recalc() {
    if (!workDate) return;

    setCalcErr("");

    try {
      const qs = new URLSearchParams();
      qs.set("workDate", workDate);
      qs.set("shiftType", shiftType || "AM");
      qs.set("punches", JSON.stringify(correctedPayload.punches));
      qs.set("breaks", JSON.stringify(correctedPayload.breaks));

      qs.set("employeeId", snapshot.employeeId);
const apiUrl = `/api/admin/payroll-correction/calc?${qs.toString()}`;
      const resp = await apiFetch<CalcResp>(apiUrl);
      setCalc(resp);
    } catch (e: any) {
      setCalc(null);
      setCalcErr(e?.message || "Failed to calculate corrected totals");
    }
  }

  useEffect(() => {
    if (!snapshot) return;
    if (correctedPayload.punches.length === 0) {
      setCalc(null);
      return;
    }
    recalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, shiftType, correctedPayload]);

  const original = snapshot?.snapshotJson || {};

  const originalGrossPayCents = Number(original.grossPayCents || 0);
  const correctedGrossPayCents = Number(calc?.pay?.grossPayCents || 0);
  const originalPayableMinutes = Number(original.payableMinutes || 0);
  const correctedPayableMinutes = Number(calc?.input?.payableMinutes || 0);

    const correctionDeltaCents = calc
  ? correctedGrossPayCents - originalGrossPayCents
  : 0;

    const correctionDirection = !calc
  ? "PENDING"
  : correctionDeltaCents > 0
  ? "UNDERPAID"
  : correctionDeltaCents < 0
  ? "OVERPAID"
  : "NO_CHANGE";
  
  const correctionBannerText =
  correctionDirection === "PENDING"
    ? "Enter corrected times to calculate pay difference"
    : correctionDirection === "UNDERPAID"
    ? "Employee was underpaid"
    : correctionDirection === "OVERPAID"
    ? "Employee was overpaid"
    : "No pay difference detected";

const correctionBannerSubtext =
  correctionDirection === "PENDING"
    ? "No corrected calculation has been created yet."
    : correctionDirection === "UNDERPAID"
    ? `Corrected pay is ${dollars(Math.abs(correctionDeltaCents))} higher than the original paid amount.`
    : correctionDirection === "OVERPAID"
    ? `Corrected pay is ${dollars(Math.abs(correctionDeltaCents))} lower than the original paid amount.`
    : "Original and corrected pay are the same.";  

  const correctionBannerStyle: React.CSSProperties =

  correctionDirection === "PENDING"
    ? {
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        color: "#374151",
      }
    : correctionDirection === "UNDERPAID"
    ? {
        border: "1px solid #bbf7d0",
        background: "#f0fdf4",
        color: "#166534",
      }
    : correctionDirection === "OVERPAID"
    ? {
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
      }
    : {
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        color: "#374151",
      };  


  async function createAdjustmentFromDelta() {
    if (!snapshot) return;

    setOk("");
    setErr("");

    if (!reason.trim()) {
      setErr("Reason required");
      return;
    }

    if (!calc) {
      setErr("Please enter corrected times first.");
      return;
    }

    if (correctionDeltaCents === 0) {
      setErr("No pay difference detected.");
      return;
    }

    const confirmed = window.confirm(
      `Create payroll adjustment of ${dollars(correctionDeltaCents)} for ${employeeLabel(
        snapshot.employee
      )}?`
    );
    if (!confirmed) return;

    setCreatingAdjustment(true);
    try {
   	await apiFetch("/api/admin/payroll-corrections", {
  method: "POST",
  body: JSON.stringify({
    payrollRunId: snapshot.payrollRunId,
    payrollRunSnapshotId: snapshot.id,
    employeeId: snapshot.employeeId,
    workDate: dateOnly(snapshot.workDate),
    reason: reason.trim(),
    originalSnapshotJson: original,
    correctedInputJson: {
      shiftType,
      punches: correctedPayload.punches,
      breaks: correctedPayload.breaks,
    },
    correctedResultJson: calc,
    adjustmentAmountCents: correctionDeltaCents,
  }),
});

setOk(`Payroll correction saved and adjustment created: ${dollars(correctionDeltaCents)}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create payroll adjustment");
    } finally {
      setCreatingAdjustment(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading correction editor…</div>;
  if (err && !snapshot) return <div style={{ padding: 16, color: "#b00020" }}>{err}</div>;
  if (!snapshot) return <div style={{ padding: 16 }}>Snapshot not found.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Payroll Correction Editor</h1>
      <div style={{ color: "#666", marginTop: 4 }}>
        Re-enter corrected times and calculate the pay difference automatically
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Original Paid Snapshot</div>

            <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    fontSize: 13,
  }}
>
            <div>
              Employee: <b>{employeeLabel(snapshot.employee)}</b>
            </div>
            <div>
              Work Date: <b>{dateOnly(snapshot.workDate)}</b>
            </div>
            <div>
              Shift: <b>{original.shiftType || "-"}</b>
            </div>
            <div>
              Facility: <b>{original.facilityName || "-"}</b>
            </div>
            <div>
              Worked: <b>{minutesToHHMM(Number(original.workedMinutes || 0))}</b>
            </div>
            <div>
              Break: <b>{minutesToHHMM(Number(original.breakMinutes || 0))}</b>
            </div>
            <div>
              Payable: <b>{minutesToHHMM(originalPayableMinutes)}</b>
            </div>
            <div>
              Gross Paid: <b>{dollars(originalGrossPayCents)}</b>
            </div>
            <div>
              Regular: <b>{minutesToHHMM(Number(original.regularMinutes || 0))}</b>
            </div>
            <div>
              OT: <b>{minutesToHHMM(Number(original.overtimeMinutes || 0))}</b>
            </div>
            <div>
              DT: <b>{minutesToHHMM(Number(original.doubleMinutes || 0))}</b>
            </div>
          </div>
        </div>

	  <div
  style={{
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  }}
>
  <div
    style={{
      ...correctionBannerStyle,
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
    }}
  >
  
  <div style={{ fontWeight: 800, fontSize: 14 }}>
  {correctionBannerText}
</div>

<div style={{ marginTop: 6, fontSize: 13 }}>
  {correctionBannerSubtext}
</div>


  </div>

  <div style={{ fontWeight: 800, marginBottom: 10 }}>Corrected Entry</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Shift Type</div>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
                <option value="NOC">NOC</option>
                <option value="AM+PM">AM+PM</option>
                <option value="PM+NOC">PM+NOC</option>
                <option value="NOC+AM">NOC+AM</option>
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
                gap: 10,
              }}
            >
              <input value={p1In} onChange={(e) => setP1In(e.target.value)} placeholder="Clock In 1" style={inputStyle} />
              <input value={b1Start} onChange={(e) => setB1Start(e.target.value)} placeholder="Meal Out 1" style={inputStyle} />
              <input value={b1End} onChange={(e) => setB1End(e.target.value)} placeholder="Meal In 1" style={inputStyle} />
              <input value={p1Out} onChange={(e) => setP1Out(e.target.value)} placeholder="Clock Out 1" style={inputStyle} />

              <input value={p2In} onChange={(e) => setP2In(e.target.value)} placeholder="Clock In 2" style={inputStyle} />
              <input value={b2Start} onChange={(e) => setB2Start(e.target.value)} placeholder="Meal Out 2" style={inputStyle} />
              <input value={b2End} onChange={(e) => setB2End(e.target.value)} placeholder="Meal In 2" style={inputStyle} />
              <input value={p2Out} onChange={(e) => setP2Out(e.target.value)} placeholder="Clock Out 2" style={inputStyle} />
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Reason</div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {calcErr ? <div style={{ color: "#b00020", fontSize: 13 }}>{calcErr}</div> : null}

            <div
  style={{
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 12,
    background: "#fafafa",
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>Corrected Calculation</div>

  {!calc ? (
    <div style={{ color: "#666", fontSize: 13 }}>
      Enter corrected times to calculate.
    </div>
  ) : (
    <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
      <div>
        Worked: <b>{minutesToHHMM(calc.input.workedMinutes)}</b>
      </div>
      <div>
        Break: <b>{minutesToHHMM(calc.input.breakMinutes)}</b>
      </div>
      <div>
        Payable: <b>{minutesToHHMM(calc.input.payableMinutes)}</b>
      </div>
      <div>
        Regular: <b>{calc.buckets.regular_HHMM}</b> ({dollars(calc.pay.regularPayCents)})
      </div>
      <div>
        OT: <b>{calc.buckets.overtime_HHMM}</b> ({dollars(calc.pay.overtimePayCents)})
      </div>
      <div>
        DT: <b>{calc.buckets.double_HHMM}</b> ({dollars(calc.pay.doublePayCents)})
      </div>
      <div>
        Corrected Gross: <b>{dollars(calc.pay.grossPayCents)}</b>
      </div>
    </div>
  )}
</div>
	
	    <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
    gap: 12,
  }}
>
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      background: "#fafafa",
    }}
  >
    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Original Paid</div>
    <div style={{ fontSize: 20, fontWeight: 800 }}>{dollars(originalGrossPayCents)}</div>
    <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
      Payable: {minutesToHHMM(originalPayableMinutes)}
    </div>
  </div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      background: "#fafafa",
    }}
  >
    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Corrected Pay</div>
    <div style={{ fontSize: 20, fontWeight: 800 }}>
  {calc ? dollars(correctedGrossPayCents) : "—"}
</div>
     <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
  Payable: {calc ? minutesToHHMM(correctedPayableMinutes) : "—"}
</div>  
</div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      background:
        correctionDirection === "UNDERPAID"
          ? "#f0fdf4"
          : correctionDirection === "OVERPAID"
          ? "#fef2f2"
          : "#f9fafb",
    }}
  >
    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Delta</div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 800,
        color:
          correctionDirection === "UNDERPAID"
            ? "#166534"
            : correctionDirection === "OVERPAID"
            ? "#991b1b"
            : "#374151",
      }}
    >
    {calc ? dollars(correctionDeltaCents) : "—"}
    </div>
    <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
      {correctionDirection === "UNDERPAID"
        ? "Adjustment owed to employee"
        : correctionDirection === "OVERPAID"
        ? "Overpayment to recover"
        : "No adjustment needed"}
    </div>
  </div>
</div>
	    <div
  style={{
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>Adjustment Preview</div>

  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
    <div>
      Employee: <b>{employeeLabel(snapshot.employee)}</b>
    </div>
    <div>
      Work Date: <b>{dateOnly(snapshot.workDate)}</b>
    </div>
    <div>
      Adjustment Type:{" "}
      <b>
        {correctionDirection === "UNDERPAID"
          ? "Underpayment correction"
          : correctionDirection === "OVERPAID"
          ? "Overpayment correction"
          : "No change"}
      </b>
    </div>
    <div>
      Adjustment Amount: <b>{dollars(correctionDeltaCents)}</b>
    </div>
    <div>
      Reason: <b>{reason || "-"}</b>
    </div>
    <div style={{ color: "#666" }}>
      This adjustment will be created as a pending payroll adjustment and applied to a future payroll run.
    </div>
  </div>
</div>
	
	    <button
  type="button"
  onClick={createAdjustmentFromDelta}
  disabled={creatingAdjustment || !calc || correctionDeltaCents === 0}
  style={{
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #111",
    background: correctionDeltaCents === 0 ? "#999" : "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: creatingAdjustment || correctionDeltaCents === 0 ? "not-allowed" : "pointer",
  }}
>
  {creatingAdjustment
    ? "Creating Adjustment..."
    : correctionDirection === "UNDERPAID"
    ? "Create Underpayment Adjustment"
    : correctionDirection === "OVERPAID"
    ? "Create Overpayment Adjustment"
    : "No Adjustment Needed"}
</button>
            {ok ? <div style={{ color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
            {err ? <div style={{ color: "#b00020", fontSize: 13 }}>{err}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #ccc",
  borderRadius: 8,
};
