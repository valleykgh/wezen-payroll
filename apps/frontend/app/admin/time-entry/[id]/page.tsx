"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { verifyAdminPinWithPrompt } from "../../../lib/pin";
import TimeEntryEditorClient from "../TimeEntryEditorClient";

export default function EditTimeEntryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

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

        const data = await apiFetch<{ entry: any }>(`/api/admin/time-entry/${id}`);
        if (!alive) return;

        const e = data.entry;
        const workDateISO = new Date(e.workDate).toISOString().slice(0, 10);

        setInitialEmployeeId(String(e.employeeId || ""));

        const punches = Array.isArray(e.punchesJson) ? e.punchesJson : [];
        const breaks = Array.isArray(e.breaksJson) ? e.breaksJson : [];

        const p1 = punches[0] ?? { clockIn: "", clockOut: "" };
        const p2 = punches[1] ?? { clockIn: "", clockOut: "" };

        const b1 = breaks[0] ?? { startTime: "", endTime: "" };
        const b2 = breaks[1] ?? { startTime: "", endTime: "" };

        setInitialDraft({
          startDate: workDateISO,
          endDate: workDateISO,
          notes: e.notes ?? "",
          days: {
            [workDateISO]: {
              date: workDateISO,
              entryId: e.id,
              status: e.status,
              facilityId: e.facilityId ?? "",
              shiftType: e.shiftType ?? "AM",
              p1,
              p2,
              b1,
              b2,
            },
          },
        });

        if (e.status === "DRAFT") {
          setPinVerified(true);
          return;
        }

        await verifyAdminPinWithPrompt(
          `This entry is ${e.status}. Enter admin PIN to edit this time card.`
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
  if (!initialDraft || !initialEmployeeId || !pinVerified) {
    return <div style={{ padding: 16 }}>Not found.</div>;
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
