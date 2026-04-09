"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type HolidayRow = {
  id: string;
  date: string;
  name: string;
  active: boolean;
  payMultiplier: number;
  billMultiplier: number;
  appliesToRegularOnly: boolean;
};

function dateOnlyUTC(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [payMultiplier, setPayMultiplier] = useState("1.5");
  const [billMultiplier, setBillMultiplier] = useState("1.5");
  const [active, setActive] = useState(true);
  const [appliesToRegularOnly, setAppliesToRegularOnly] = useState(true);

  const [editingId, setEditingId] = useState<string>("");
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editPayMultiplier, setEditPayMultiplier] = useState("1.5");
  const [editBillMultiplier, setEditBillMultiplier] = useState("1.5");
  const [editActive, setEditActive] = useState(true);
  const [editAppliesToRegularOnly, setEditAppliesToRegularOnly] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch<{ holidays: any[] }>("/api/admin/holidays");
      const rows = (res.holidays || []).map((h) => ({
        id: String(h.id),
        date: dateOnlyUTC(h.date),
        name: String(h.name || ""),
        active: !!h.active,
        payMultiplier: Number(h.payMultiplier || 1.5),
        billMultiplier: Number(h.billMultiplier || 1.5),
        appliesToRegularOnly: !!h.appliesToRegularOnly,
      }));
      setHolidays(rows);
    } catch (e: any) {
      setErr(e?.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }

  async function createHoliday() {
    setErr("");
    setOk("");

    if (!date.trim()) {
      setErr("Date is required.");
      return;
    }
    if (!name.trim()) {
      setErr("Holiday name is required.");
      return;
    }

    try {
      await apiFetch("/api/admin/holidays", {
        method: "POST",
        body: JSON.stringify({
          date,
          name: name.trim(),
          payMultiplier: Number(payMultiplier || 1.5),
          billMultiplier: Number(billMultiplier || 1.5),
          active,
          appliesToRegularOnly,
        }),
      });

      setDate("");
      setName("");
      setPayMultiplier("1.5");
      setBillMultiplier("1.5");
      setActive(true);
      setAppliesToRegularOnly(true);
      setOk("Holiday created.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create holiday");
    }
  }

  function startEdit(h: HolidayRow) {
    setEditingId(h.id);
    setEditDate(h.date);
    setEditName(h.name);
    setEditPayMultiplier(String(h.payMultiplier));
    setEditBillMultiplier(String(h.billMultiplier));
    setEditActive(!!h.active);
    setEditAppliesToRegularOnly(!!h.appliesToRegularOnly);
    setErr("");
    setOk("");
  }

  function cancelEdit() {
    setEditingId("");
    setEditDate("");
    setEditName("");
    setEditPayMultiplier("1.5");
    setEditBillMultiplier("1.5");
    setEditActive(true);
    setEditAppliesToRegularOnly(true);
  }

  async function saveEdit(id: string) {
    setErr("");
    setOk("");

    if (!editDate.trim()) {
      setErr("Date is required.");
      return;
    }
    if (!editName.trim()) {
      setErr("Holiday name is required.");
      return;
    }

    try {
      await apiFetch(`/api/admin/holidays/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: editDate,
          name: editName.trim(),
          payMultiplier: Number(editPayMultiplier || 1.5),
          billMultiplier: Number(editBillMultiplier || 1.5),
          active: editActive,
          appliesToRegularOnly: editAppliesToRegularOnly,
        }),
      });

      setOk("Holiday updated.");
      cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to update holiday");
    }
  }

  async function toggleActive(h: HolidayRow) {
    setErr("");
    setOk("");
    try {
      await apiFetch(`/api/admin/holidays/${h.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          active: !h.active,
        }),
      });

      setOk(!h.active ? "Holiday activated." : "Holiday deactivated.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to update holiday status");
    }
  }

  async function deleteHoliday(id: string) {
    const confirmed = window.confirm("Delete this holiday?");
    if (!confirmed) return;

    setErr("");
    setOk("");
    try {
      await apiFetch(`/api/admin/holidays/${id}`, {
        method: "DELETE",
      });

      setOk("Holiday deleted.");
      if (editingId === id) cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete holiday");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  return (
     <div style={{ padding: 0, maxWidth: 1100, margin: "0 auto" }}> 
      <h2
  style={{
    marginTop: 0,
    marginBottom: 10,
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  }}
>
  Holidays
</h2>
       <div
  style={{
    marginBottom: 14,
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.7,
    fontWeight: 500,
  }}
> 
       Multipliers apply to hourly rates.
        <br />
        • 1.5× = Time-and-a-half
        <br />
        • 2× = Double-time
      </div>

      <div
        style={{
        border: "1px solid #e2e8f0",
borderRadius: 24,
padding: 20,
marginBottom: 18,
background: "#ffffff",
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
	}}
      >
<div style={{ fontWeight: 800, marginBottom: 14, color: "#0f172a", fontSize: 24 }}>
  Add Holiday
</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 160px 160px",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Holiday name"
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
            type="number"
            step="0.1"
            value={payMultiplier}
            onChange={(e) => setPayMultiplier(e.target.value)}
            placeholder="Employee pay"
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
            type="number"
            step="0.1"
            value={billMultiplier}
            onChange={(e) => setBillMultiplier(e.target.value)}
            placeholder="Client billing"
            style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}} 
	 />
        </div>


	<div style={{ marginTop: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: "#475569",
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    <input
      type="checkbox"
      checked={active}
      onChange={(e) => setActive(e.target.checked)}
    />
    Active
  </label>

  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: "#475569",
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    <input
      type="checkbox"
      checked={appliesToRegularOnly}
      onChange={(e) => setAppliesToRegularOnly(e.target.checked)}
    />
    Apply multiplier to first 8 hours only
  </label>
</div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={createHoliday}
            style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(37, 99, 235, 0.18)",
}}
	  >
            Add Holiday
          </button>
        </div>
      </div>

      {loading ? <div style={{ marginBottom: 12 }}>Loading...</div> : null}

{err ? (
  <div
    style={{
      marginBottom: 12,
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

{ok ? (
  <div
    style={{
      marginBottom: 12,
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

<div
  style={{
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    overflow: "hidden",
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 900,
    }}
  >

        <thead>
         <tr style={{ background: "#f8fafc" }}>   
         <th style={th}>Date</th>
<th style={th}>Name</th>
<th style={th}>Employee Pay</th>
<th style={th}>Client Billing</th>
<th style={th}>Active</th>
<th style={th}>Regular Hours Only</th>
<th style={th}>Actions</th> 
	 </tr>
        </thead>
        <tbody>
          {sortedHolidays.map((h) => {
            const editing = editingId === h.id;

            return (
              <tr
                key={h.id}
                style={{
                background: h.active ? "#fffbeb" : "#ffffff",
		 }}
              >
                 <td style={td}> 
	         {editing ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      style={{
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
}} 
	           />
                  ) : (
                    h.date
                  )}
                </td>

                <td style={td}>
                  {editing ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
}} 
		   />
                  ) : (
                    <>
                      <span>{h.name}</span>
                      {h.active ? (
                        <span
                          style={{
                            marginLeft: 8,
                            background: "#f59e0b",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 999,
                            verticalAlign: "middle",
                          }}
                        >
                          HOLIDAY
                        </span>
                      ) : null}
                    </>
                  )}
                </td>

                <td style={td}>  
		{editing ? (
                    <input
                      type="number"
                      step="0.1"
                      value={editPayMultiplier}
                      onChange={(e) => setEditPayMultiplier(e.target.value)}
                      style={{
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
}} 
		   />
                  ) : (
                    <>
                      <b>{h.payMultiplier}×</b>
                      <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>  
			{Number(h.payMultiplier) === 1.5
                          ? "Time-and-a-half"
                          : Number(h.payMultiplier) === 2
                          ? "Double-time"
                          : "Custom"}
                      </div>
                    </>
                  )}
                </td>

                <td style={td}>  
	  	{editing ? (
                    <input
                      type="number"
                      step="0.1"
                      value={editBillMultiplier}
                      onChange={(e) => setEditBillMultiplier(e.target.value)}
                      style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8, width: 90 }}
                    />
                  ) : (
                    <>
                      <b>{h.billMultiplier}×</b>
                      <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>  
			{Number(h.billMultiplier) === 1.5
                          ? "Time-and-a-half"
                          : Number(h.billMultiplier) === 2
                          ? "Double-time"
                          : "Custom"}
                      </div>
                    </>
                  )}
                </td>

                <td style={td}>  
		{editing ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />{" "}
                      Active
                    </label>
                  ) : h.active ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </td>

                <td style={td}>  
		{editing ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={editAppliesToRegularOnly}
                        onChange={(e) => setEditAppliesToRegularOnly(e.target.checked)}
                      />{" "}
                      Yes
                    </label>
                  ) : h.appliesToRegularOnly ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </td>

                <td style={td}>  
		{editing ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => saveEdit(h.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #166534",
background: "#166534",
color: "#ffffff",
fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
background: "#ffffff",
color: "#0f172a",
fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(h)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(h)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #fdba74",
background: "#fff7ed",
color: "#92400e",
fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {h.active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteHoliday(h.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
background: "#fef2f2",
color: "#b91c1c",
fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {sortedHolidays.length === 0 ? (
            <tr>
             <td colSpan={7} style={{ textAlign: "center", padding: 20, color: "#475569", fontWeight: 500 }}>   
		No holidays found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
     </div>
  );
}
const th: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  textAlign: "left",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#334155",
  fontSize: 14,
  fontWeight: 500,
};
