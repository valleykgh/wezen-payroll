"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { verifyAdminPinWithPrompt } from "../../../lib/pin";
import TimeEntryEditorClient from "../TimeEntryEditorClient";
function toDisplayTime(v?: string | null): string {
  const s = String(v || "").trim();
  if (!s) return "";

  if (/[ap]\.?m\.?/i.test(s) || /^\d{1,2}:\d{2}$/.test(s)) {
    return s;
  }

  if (s.includes("T")) {
    const m = s.match(/T(\d{2}):(\d{2})/);
    if (m) {
      const hh = Number(m[1]);
      const mm = m[2];
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
export default function EditTimeEntryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const sourceType = searchParams.get("sourceType");
  const isAdjustment = sourceType === "PAYROLL_ADJUSTMENT";
  const [initialDraft, setInitialDraft] = useState<any>(null);
  const [initialEmployeeId, setInitialEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pinVerified, setPinVerified] = useState(false);

  useEffect(() => {
    if (!id) return;

    let alive = true;

    (async () => {
      try {
        setErr("");

        let e: any;

	if (isAdjustment) {
  	const data = await apiFetch<{ adjustment: any }>(`/api/admin/payroll-adjustments/${id}`);
  	if (!alive) return;
  	e = data.adjustment;
	} else {
  	const data = await apiFetch<{ entry: any }>(`/api/admin/time-entry/${id}`);
  	if (!alive) return;
  	e = data.entry;
	}

	const workDateISO = e.workDate
        ? new Date(e.workDate).toISOString().slice(0, 10)
        : "";	

        setInitialEmployeeId(String(e.employeeId || ""));

        const punches = Array.isArray(e.punchesJson) ? e.punchesJson : [];
        const breaks = Array.isArray(e.breaksJson) ? e.breaksJson : [];

        const p1 = {
  clockIn: toDisplayTime(punches[0]?.clockIn),
  clockOut: toDisplayTime(punches[0]?.clockOut),
};

const p2 = {
  clockIn: toDisplayTime(punches[1]?.clockIn),
  clockOut: toDisplayTime(punches[1]?.clockOut),
};

const b1 = {
  startTime: toDisplayTime(breaks[0]?.startTime),
  endTime: toDisplayTime(breaks[0]?.endTime),
};

const b2 = {
  startTime: toDisplayTime(breaks[1]?.startTime),
  endTime: toDisplayTime(breaks[1]?.endTime),
};

        setInitialDraft({
  startDate: workDateISO,
  endDate: workDateISO,
  notes: e.notes ?? e.reason ?? "",
  sourceType: isAdjustment ? "PAYROLL_ADJUSTMENT" : "TIME_ENTRY",
  sourceId: e.id,
  days: {
    [workDateISO]: {
      date: workDateISO,
      entryId: isAdjustment ? undefined : e.id,
      adjustmentId: isAdjustment ? e.id : undefined,
      status: e.status ?? "APPROVED",
      facilityId: e.facilityId ?? "",
      shiftType: e.shiftType ?? "AM",
        p1,
	p2,
	b1,
	b2,
      isMissedAdjustment: isAdjustment,
      sourceType: isAdjustment ? "PAYROLL_ADJUSTMENT" : "TIME_ENTRY",
    },
  },
});

	if (!isAdjustment && e.status === "DRAFT") {
  setPinVerified(true);
  return;
}
       await verifyAdminPinWithPrompt(
  isAdjustment
    ? "This missed-entry adjustment requires admin PIN to edit."
    : `This entry is ${e.status}. Enter admin PIN to edit this time card.`
);

        setPinVerified(true);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load time entry");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, color: "#b00020" }}>{err}</div>;
  if (!initialDraft || !initialEmployeeId) {
  return <div style={{ padding: 16 }}>Not found.</div>;
}

if (!pinVerified) {
  return <div style={{ padding: 16 }}>PIN verification required.</div>;
}
  return (
    <TimeEntryEditorClient
      initialEmployeeId={initialEmployeeId}
      initialDraft={initialDraft}
      lockEmployeeTabs={true}
      allowStatusOverrideEdit={true}
    />
  );
}
