// apps/frontend/app/lib/timeEntriesApi.ts
import { apiFetch } from "./api";

export type TimeEntryListParams = {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  employeeId?: string;
  employeeIds?: string; // comma-separated
  status?: string; // DRAFT|APPROVED|LOCKED
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function listTimeEntries(params: TimeEntryListParams) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });

  return apiFetch<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    entries: any[];
  }>(`/api/admin/time-entries?${qs.toString()}`, { auth: true });
}

// Optional (recommended) backend endpoint; see below.
// For now, we can still build edit page off list data,
// but single-get is cleaner.
export async function getTimeEntry(id: string) {
  return apiFetch<{ entry: any }>(`/api/admin/time-entry/${id}`, { auth: true });
}

export async function updateTimeEntry(id: string, payload: any) {
  return apiFetch<{ entry: any }>(`/api/admin/time-entry/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    auth: true,
  });
}

export async function updateTimeEntryBreaks(id: string, payload: any) {
  return apiFetch<{ ok: boolean; breakMinutes: number; breaksStored: number }>(
    `/api/admin/time-entry/${id}/breaks`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      auth: true,
    }
  );
}

export async function createTimeEntry(payload: any) {
  return apiFetch<{ entry: any }>(`/api/admin/time-entry`, {
    method: "POST",
    body: JSON.stringify(payload),
    auth: true,
  });
}
