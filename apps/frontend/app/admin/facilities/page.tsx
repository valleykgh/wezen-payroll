"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type FacilityRate = {
  id: string;
  facilityId: string | null;
  title: "CNA" | "LVN" | "RN";
  effectiveFrom: string;
  regRateCents: number;
  otRateCents: number;
  dtRateCents: number;
  createdAt?: string;
  updatedAt?: string;
};

type Facility = {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  rates?: FacilityRate[];
};

function centsFromDollarsInput(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function dollarsFromCents(cents: number | null | undefined) {
  return ((Number(cents || 0) / 100) || 0).toFixed(2);
}

function isoDateOnly(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

type RateDraft = {
  effectiveFrom: string;
  regRate: string;
  otRate: string;
  dtRate: string;
};

const TITLES: Array<"CNA" | "LVN" | "RN"> = ["CNA", "LVN", "RN"];

export default function FacilitiesAdminPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [newFacilityName, setNewFacilityName] = useState("");

  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, Record<string, RateDraft>>>({});

  async function loadFacilities() {
    setLoading(true);
    setErr("");
    try {
      const resp = await apiFetch<{ facilities: Facility[] }>("/api/admin/facilities");
      const list = resp.facilities || [];
      setFacilities(list);

      const nextRename: Record<string, string> = {};
      const nextRateDrafts: Record<string, Record<string, RateDraft>> = {};

      for (const f of list) {
        nextRename[f.id] = f.name;

        const byTitle: Record<string, RateDraft> = {};
        for (const title of TITLES) {
          const latest = (f.rates || [])
            .filter((r) => r.title === title)
            .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];

          byTitle[title] = {
            effectiveFrom: latest ? isoDateOnly(latest.effectiveFrom) : new Date().toISOString().slice(0, 10),
            regRate: latest ? dollarsFromCents(latest.regRateCents) : "",
            otRate: latest ? dollarsFromCents(latest.otRateCents) : "",
            dtRate: latest ? dollarsFromCents(latest.dtRateCents) : "",
          };
        }

        nextRateDrafts[f.id] = byTitle;
      }

      setRenameDrafts(nextRename);
      setRateDrafts(nextRateDrafts);
    } catch (e: any) {
      setErr(e?.message || "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFacilities().catch(() => {});
  }, []);

  const sortedFacilities = useMemo(() => {
    return [...facilities].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [facilities]);

  function setRateDraft(facilityId: string, title: string, patch: Partial<RateDraft>) {
    setRateDrafts((prev) => ({
      ...prev,
      [facilityId]: {
        ...(prev[facilityId] || {}),
        [title]: {
          effectiveFrom: "",
          regRate: "",
          otRate: "",
          dtRate: "",
          ...(prev[facilityId]?.[title] || {}),
          ...patch,
        },
      },
    }));
  }

  async function createFacility() {
    setErr("");
    setOk("");

    const name = newFacilityName.trim();
    if (!name) {
      setErr("Facility name is required.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/admin/facilities", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewFacilityName("");
      setOk("Facility created.");
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to create facility");
    } finally {
      setSaving(false);
    }
  }

  async function renameFacility(facilityId: string) {
    setErr("");
    setOk("");

    const name = String(renameDrafts[facilityId] || "").trim();
    if (!name) {
      setErr("Facility name is required.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/admin/facilities/${encodeURIComponent(facilityId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setOk("Facility updated.");
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to update facility");
    } finally {
      setSaving(false);
    }
  }

  async function archiveOrRestoreFacility(facility: Facility) {
    setErr("");
    setOk("");

    const pin = window.prompt(
      `${facility.active ? "Archive" : "Restore"} facility "${facility.name}"\n\nEnter admin PIN:`
    );
    if (!pin) return;

    setSaving(true);
    try {
      const path = facility.active
        ? `/api/admin/facilities/${encodeURIComponent(facility.id)}/archive`
        : `/api/admin/facilities/${encodeURIComponent(facility.id)}/restore`;

      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      setOk(facility.active ? "Facility archived." : "Facility restored.");
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to update facility status");
    } finally {
      setSaving(false);
    }
  }

  async function saveRate(facility: Facility, title: "CNA" | "LVN" | "RN") {
    setErr("");
    setOk("");

    const draft = rateDrafts[facility.id]?.[title];
    if (!draft) {
      setErr("Missing rate draft.");
      return;
    }

    if (!draft.effectiveFrom) {
      setErr(`Effective date is required for ${facility.name} / ${title}.`);
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/admin/facilities/${encodeURIComponent(facility.id)}/rates`, {
        method: "POST",
        body: JSON.stringify({
          title,
          effectiveFrom: draft.effectiveFrom,
          regRateCents: centsFromDollarsInput(draft.regRate),
          otRateCents: centsFromDollarsInput(draft.otRate),
          dtRateCents: centsFromDollarsInput(draft.dtRate),
        }),
      });

      setOk(`Saved ${title} billing rate for ${facility.name}.`);
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to save billing rate");
    } finally {
      setSaving(false);
    }
  }

  function renderRateHistory(facility: Facility, title: "CNA" | "LVN" | "RN") {
    const rows = (facility.rates || [])
      .filter((r) => r.title === title)
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));

    if (rows.length === 0) {
      return <div style={{ fontSize: 12, color: "#666" }}>No saved rates yet.</div>;
    }

    return (
      <div style={{ marginTop: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "6px 4px", fontSize: 12 }}>Effective</th>
              <th style={{ padding: "6px 4px", fontSize: 12 }}>Reg</th>
              <th style={{ padding: "6px 4px", fontSize: 12 }}>OT</th>
              <th style={{ padding: "6px 4px", fontSize: 12 }}>DT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "6px 4px", fontSize: 12 }}>{isoDateOnly(r.effectiveFrom)}</td>
                <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.regRateCents)}</td>
                <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.otRateCents)}</td>
                <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.dtRateCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1300, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Facilities</h1>
      <div style={{ fontSize: 13, color: "#666" }}>
        Manage facilities and billing rates by designation.
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Create Facility</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={newFacilityName}
            onChange={(e) => setNewFacilityName(e.target.value)}
            placeholder="Facility name"
            style={{ minWidth: 280, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={createFacility}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
            }}
          >
            Add Facility
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={loadFacilities}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {ok ? <div style={{ marginTop: 12, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
      {err ? <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>{err}</div> : null}

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        {sortedFacilities.length === 0 ? (
          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, color: "#666" }}>
            {loading ? "Loading facilities..." : "No facilities yet."}
          </div>
        ) : (
          sortedFacilities.map((facility) => (
            <div
              key={facility.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 14,
                background: facility.active ? "#fff" : "#fafafa",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{facility.name}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: facility.active ? "#0a7a2f" : "#b45309" }}>
                    {facility.active ? "Active" : "Archived"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={renameDrafts[facility.id] || ""}
                    onChange={(e) =>
                      setRenameDrafts((prev) => ({ ...prev, [facility.id]: e.target.value }))
                    }
                    style={{ minWidth: 220, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => renameFacility(facility.id)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => archiveOrRestoreFacility(facility)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: facility.active ? "1px solid #b91c1c" : "1px solid #0a7a2f",
                      background: facility.active ? "#fef2f2" : "#f0fdf4",
                      color: facility.active ? "#b91c1c" : "#0a7a2f",
                    }}
                  >
                    {facility.active ? "Archive" : "Restore"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Billing Rates</div>

                <div style={{ display: "grid", gap: 14 }}>
                  {TITLES.map((title) => {
                    const draft = rateDrafts[facility.id]?.[title] || {
                      effectiveFrom: "",
                      regRate: "",
                      otRate: "",
                      dtRate: "",
                    };

                    return (
                      <div
                        key={`${facility.id}-${title}`}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 12,
                          padding: 12,
                          background: "#fcfcfc",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Effective From</div>
                            <input
                              type="date"
                              value={draft.effectiveFrom}
                              onChange={(e) =>
                                setRateDraft(facility.id, title, { effectiveFrom: e.target.value })
                              }
                              style={{ padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Regular Rate ($)</div>
                            <input
                              value={draft.regRate}
                              onChange={(e) =>
                                setRateDraft(facility.id, title, { regRate: e.target.value })
                              }
                              placeholder="0.00"
                              style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>OT Rate ($)</div>
                            <input
                              value={draft.otRate}
                              onChange={(e) =>
                                setRateDraft(facility.id, title, { otRate: e.target.value })
                              }
                              placeholder="0.00"
                              style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>DT Rate ($)</div>
                            <input
                              value={draft.dtRate}
                              onChange={(e) =>
                                setRateDraft(facility.id, title, { dtRate: e.target.value })
                              }
                              placeholder="0.00"
                              style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                            />
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveRate(facility, title)}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: "1px solid #111",
                              background: "#111",
                              color: "#fff",
                              height: 40,
                            }}
                          >
                            Save {title} Rate
                          </button>
                        </div>

                        {renderRateHistory(facility, title)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
