import { STAFFING_API_BASE_URL } from '@/lib/api-base';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${STAFFING_API_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `API request failed for ${url}: ${res.status} ${res.statusText}${text ? ` | body: ${text}` : ''}`
    );
  }

  return text ? JSON.parse(text) : ({} as T);
}
