// apps/frontend/app/lib/api.ts
import { getToken } from "./auth";

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return "http://localhost:4001";
  return base.replace(/\/+$/, "");
}

async function readBody(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json().catch(() => null);
  }
  return await res.text().catch(() => null);
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const url = `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    ...(opts.headers as any),
  };

  // Only set JSON header if we are sending a body (GET shouldn't force it)
  const hasBody = opts.body !== undefined && opts.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...opts,
    headers,
  });

  const body = await readBody(res);

  if (!res.ok) {
    // common backend shape: { error: "..." }
    const msg =
      (body && typeof body === "object" && (body.error || body.message)) ||
      (typeof body === "string" && body) ||
      `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return body as T;
}
