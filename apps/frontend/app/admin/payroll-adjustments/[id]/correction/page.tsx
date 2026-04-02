"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

export default function PayrollAdjustmentCorrectionPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ adjustment: any }>(
          `/api/admin/payroll-adjustments/${id}`
        );

        const a = data.adjustment;

        setEmployeeId(a.employeeId);
        setFacilityId(a.facilityId);
        setWorkDate(new Date(a.workDate).toISOString().slice(0, 10));
        setHours(String((a.payableMinutes || 0) / 60));
        setReason(`Correction of adjustment ${id}`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) load();
  }, [id]);

  async function save() {
    try {
      setSaving(true);

      await apiFetch(`/api/admin/payroll-adjustments/${id}/correction`, {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          facilityId,
          workDate,
          hours,
          reason,
        }),
      });

      alert("Correction created");

      router.push("/admin/time-entries-week");
    } catch (err) {
      console.error(err);
      alert("Failed to create correction");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Create Correction</h2>

      <div style={{ marginTop: 12 }}>
        <label>Work Date</label>
        <input
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Hours</label>
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Reason</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{ marginTop: 20 }}
      >
        {saving ? "Saving..." : "Create Correction"}
      </button>
    </div>
  );
}
