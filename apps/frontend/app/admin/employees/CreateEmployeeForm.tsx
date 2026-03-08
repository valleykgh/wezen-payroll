"use client";

import React, { useState } from "react";
import { apiFetch } from "../../lib/api";

type Title = "CNA" | "LVN" | "RN";

export default function CreateEmployeeForm({ onCreated }: { onCreated?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState("25.00");
  const [newTitle, setNewTitle] = useState<Title>("CNA");
  const [addressLine1, setAddressLine1] = useState("");
const [addressLine2, setAddressLine2] = useState("");
const [city, setCity] = useState("");
const [stateProv, setStateProv] = useState("");
const [zip, setZip] = useState("");
const [ssnLast4, setSsnLast4] = useState("");

function isValidEmail(email: string) {
  // simple + practical (not overly strict)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

  async function createEmployee() {
  setErr(null);

  if (!legalName || !email) {
    setErr("legalName and email are required");
    return;
  }

  const hourlyRateCents = Math.round(Number(hourlyRate || 0) * 100);
  if (!Number.isFinite(hourlyRateCents)) {
    setErr("Invalid hourly rate");
    return;
  }

  const emailTrim = email.trim();
  if (!isValidEmail(emailTrim)) {
    setErr("Please enter a valid email address.");
    return;
  }

  const zipDigits = onlyDigits(zip);
  if (zipDigits && !/^\d{5}$/.test(zipDigits)) {
    setErr("Zip code must be exactly 5 digits.");
    return;
  }

  const ssnDigits = onlyDigits(ssnLast4);
  if (ssnDigits && !/^\d{4}$/.test(ssnDigits)) {
    setErr("SSN last 4 must be exactly 4 digits.");
    return;
  }

  setLoading(true);
  try {
    await apiFetch("/api/admin/employees", {
      method: "POST",
      body: JSON.stringify({
        legalName,
        preferredName: preferredName || null,
        email: emailTrim,
        hourlyRateCents,
        title: (newTitle || "CNA").trim().toUpperCase(),

        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        stateProv: stateProv || null,
        zip: zipDigits || null,
        ssnLast4: ssnDigits || null,
      }),
    });

    // clear form
    setLegalName("");
    setPreferredName("");
    setEmail("");
    setHourlyRate("25.00");
    setNewTitle("CNA");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setStateProv("");
    setZip("");
    setSsnLast4("");

    onCreated?.();
  } catch (e: any) {
    setErr(e?.message || "Failed to create employee");
  } finally {
    setLoading(false);
  }
}
  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
      {err ? <div style={{ marginBottom: 10, color: "#b00020" }}>{err}</div> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Legal Name</div>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Preferred Name (optional)</div>
          <input
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ minWidth: 320 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Hourly Rate ($)</div>
          <input
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Title</div>
          <select
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value as Title)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="CNA">CNA</option>
            <option value="LVN">LVN</option>
            <option value="RN">RN</option>
          </select>
        </div>
        <div style={{ minWidth: 300 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Address Line 1</div>
  <input
    value={addressLine1}
    onChange={(e) => setAddressLine1(e.target.value)}
    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
  />
</div>

<div style={{ minWidth: 300 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Address Line 2</div>
  <input
    value={addressLine2}
    onChange={(e) => setAddressLine2(e.target.value)}
    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
  />
</div>

<div style={{ minWidth: 180 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>City</div>
  <input
    value={city}
    onChange={(e) => setCity(e.target.value)}
    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
  />
</div>

<div style={{ minWidth: 120 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>State</div>
  <input
    value={stateProv}
    onChange={(e) => setStateProv(e.target.value)}
    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
  />
</div>

<div style={{ minWidth: 140 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Zip</div>
  <input
  value={zip}
  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
  style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
/>
</div>

<div style={{ minWidth: 140 }}>
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SSN (Last 4)</div>

<input
  value={ssnLast4}
  onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
  maxLength={4}
  style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
/>
</div>
        <button
          disabled={loading}
          onClick={createEmployee}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", height: 42 }}
        >
          Create Employee
        </button>
      </div>
    </div>
  );
}
