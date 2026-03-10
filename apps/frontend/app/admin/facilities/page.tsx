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

type RateDraft = {
  effectiveFrom: string;
  regRate: string;
  otRate: string;
  dtRate: string;
};

const TITLES: Array<"CNA" | "LVN" | "RN"> = ["CNA", "LVN", "RN"];

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

export default function FacilitiesAdminPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [newFacilityName, setNewFacilityName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [rateDrafts, setRateDrafts] = useState<Record<string, RateDraft>>({});

  async function loadFacilities() {
    setLoading(true);
    setErr("");
    try {
      const resp = await apiFetch<{ facilities: Facility[] }>("/api/admin/facilities");
      const list = resp.facilities || [];
      setFacilities(list);

      if (!selectedFacilityId && list.length > 0) {
        setSelectedFacilityId(list[0].id);
      }
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
    return [...facilities].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [facilities]);

  const selectedFacility = useMemo(() => {
    return sortedFacilities.find((f) => f.id === selectedFacilityId) || null;
  }, [sortedFacilities, selectedFacilityId]);

  useEffect(() => {
    if (!selectedFacility) return;

    setRenameDraft(selectedFacility.name);

    const nextDrafts: Record<string, RateDraft> = {};
    for (const title of TITLES) {
      const latest = (selectedFacility.rates || [])
        .filter((r) => r.title === title)
        .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];

      nextDrafts[title] = {
        effectiveFrom: latest ? isoDateOnly(latest.effectiveFrom) : new Date().toISOString().slice(0, 10),
        regRate: latest ? dollarsFromCents(latest.regRateCents) : "",
        otRate: latest ? dollarsFromCents(latest.otRateCents) : "",
        dtRate: latest ? dollarsFromCents(latest.dtRateCents) : "",
      };
    }

    setRateDrafts(nextDrafts);
  }, [selectedFacility]);

  function setRateDraft(title: string, patch: Partial<RateDraft>) {
    setRateDrafts((prev) => ({
      ...prev,
      [title]: {
        effectiveFrom: "",
        regRate: "",
        otRate: "",
        dtRate: "",
        ...(prev[title] || {}),
        ...patch,
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

  async function renameFacility() {
    if (!selectedFacility) return;

    setErr("");
    setOk("");

    const name = renameDraft.trim();
    if (!name) {
      setErr("Facility name is required.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/admin/facilities/${encodeURIComponent(selectedFacility.id)}`, {
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

  async function archiveOrRestoreFacility() {
    if (!selectedFacility) return;

    setErr("");
    setOk("");

    const pin = window.prompt(
      `${selectedFacility.active ? "Archive" : "Restore"} facility "${selectedFacility.name}"\n\nEnter admin PIN:`
    );
    if (!pin) return;

    setSaving(true);
    try {
      const path = selectedFacility.active
        ? `/api/admin/facilities/${encodeURIComponent(selectedFacility.id)}/archive`
        : `/api/admin/facilities/${encodeURIComponent(selectedFacility.id)}/restore`;

      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      setOk(selectedFacility.active ? "Facility archived." : "Facility restored.");
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to update facility status");
    } finally {
      setSaving(false);
    }
  }

  async function saveOneRate(title: "CNA" | "LVN" | "RN", pin: string) {
    if (!selectedFacility) return;

    const draft = rateDrafts[title];
    if (!draft?.effectiveFrom) {
      throw new Error(`Effective date is required for ${title}.`);
    }

    await apiFetch(`/api/admin/facilities/${encodeURIComponent(selectedFacility.id)}/rates`, {
      method: "POST",
      body: JSON.stringify({
        pin,
        title,
        effectiveFrom: draft.effectiveFrom,
        regRateCents: centsFromDollarsInput(draft.regRate),
        otRateCents: centsFromDollarsInput(draft.otRate),
        dtRateCents: centsFromDollarsInput(draft.dtRate),
      }),
    });
  }

  async function saveAllRates() {
    if (!selectedFacility) return;

    setErr("");
    setOk("");

    const pin = window.prompt(
      `Save all billing rates for "${selectedFacility.name}"\n\nEnter admin PIN:`
    );
    if (!pin) return;

    setSaving(true);
    try {
      for (const title of TITLES) {
        await saveOneRate(title, pin);
      }

      setOk(`Saved all rates for ${selectedFacility.name}.`);
      await loadFacilities();
    } catch (e: any) {
      setErr(e?.message || "Failed to save rates");
    } finally {
      setSaving(false);
    }
  }

  function renderSavedRates(title: "CNA" | "LVN" | "RN") {
    if (!selectedFacility) return null;

    const rows = (selectedFacility.rates || [])
      .filter((r) => r.title === title)
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));

    if (rows.length === 0) {
      return <div style={{ fontSize: 12, color: "#666" }}>No saved rates yet.</div>;
    }

    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th style={{ padding: "6px 4px", fontSize: 12 }}>Effective From</th>
            <th style={{ padding: "6px 4px", fontSize: 12 }}>Reg</th>
            <th style={{ padding: "6px 4px", fontSize: 12 }}>OT</th>
            <th style={{ padding: "6px 4px", fontSize: 12 }}>DT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={{ padding: "6px 4px", fontSize: 12 }}>{isoDateOnly(r.effectiveFrom)}</td>
              <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.regRateCents)}</td>
              <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.otRateCents)}</td>
              <td style={{ padding: "6px 4px", fontSize: 12 }}>${dollarsFromCents(r.dtRateCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Facilities</h1>
      <div style={{ fontSize: 13, color: "#666" }}>
        Review facilities and manage billing rates by designation.
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Create Facility</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
        </div>
      </div>

      {ok ? <div style={{ marginTop: 12, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
      {err ? <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>{err}</div> : null}

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Select Facility</div>
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              style={{ minWidth: 280, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              {sortedFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.active ? "" : " (Archived)"}
                </option>
              ))}
            </select>
          </div>

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

        {selectedFacility ? (
          <>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedFacility.name}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: selectedFacility.active ? "#0a7a2f" : "#b45309" }}>
                  {selectedFacility.active ? "Active" : "Archived"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  style={{ minWidth: 220, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={renameFacility}
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
                  onClick={archiveOrRestoreFacility}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: selectedFacility.active ? "1px solid #b91c1c" : "1px solid #0a7a2f",
                    background: selectedFacility.active ? "#fef2f2" : "#f0fdf4",
                    color: selectedFacility.active ? "#b91c1c" : "#0a7a2f",
                  }}
                >
                  {selectedFacility.active ? "Archive" : "Restore"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Billing Rates</div>

              <div style={{ display: "grid", gap: 16 }}>
                {TITLES.map((title) => {
                  const draft = rateDrafts[title] || {
                    effectiveFrom: "",
                    regRate: "",
                    otRate: "",
                    dtRate: "",
                  };

                  return (
                    <div
                      key={title}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fcfcfc",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{title}</div>

                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Effective From</div>
                          <input
                            type="date"
                            value={draft.effectiveFrom}
                            onChange={(e) => setRateDraft(title, { effectiveFrom: e.target.value })}
                            style={{ padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Regular Rate ($)</div>
                          <input
                            value={draft.regRate}
                            onChange={(e) => setRateDraft(title, { regRate: e.target.value })}
                            style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>OT Rate ($)</div>
                          <input
                            value={draft.otRate}
                            onChange={(e) => setRateDraft(title, { otRate: e.target.value })}
                            style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>DT Rate ($)</div>
                          <input
                            value={draft.dtRate}
                            onChange={(e) => setRateDraft(title, { dtRate: e.target.value })}
                            style={{ width: 110, padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Saved Rates</div>
                        {renderSavedRates(title)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveAllRates}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  Save All Rates
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16, color: "#666" }}>
            {loading ? "Loading facilities..." : "No facility selected."}
          </div>
        )}
      </div>
    </div>
  );
}
