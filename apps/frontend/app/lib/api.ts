function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return "http://localhost:4000";
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

  const headers = new Headers(opts.headers || {});
  const hasBody = opts.body !== undefined && opts.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const pin = localStorage.getItem("admin_override_pin") || "";
    if (pin) headers.set("x-admin-pin", pin);
  }

  const res = await fetch(url, {
    ...opts,
    headers,
    credentials: "include",
  });

  const body = await readBody(res);

  if (!res.ok) {
    throw new Error(body?.error || body || "Request failed");
  }

  return body as T;
}
