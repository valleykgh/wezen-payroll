import { STAFFING_API_BASE_URL } from '@/lib/api-base';

export function formatApiErrorText(text: string, fallback = 'Request failed') {
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text);

    const base =
      typeof parsed?.error === 'string'
        ? parsed.error
        : typeof parsed?.message === 'string'
          ? parsed.message
          : fallback;

    if (Array.isArray(parsed?.reasons) && parsed.reasons.length > 0) {
      return `${base}\n\n${parsed.reasons.map((reason: string) => `• ${reason}`).join('\n')}`;
    }

    return base;
  } catch {
    return text
      .replace(/^API request failed for .*?\| body:\s*/i, '')
      .replace(/^{"error":"|"}$/g, '')
      .trim() || fallback;
  }
}

function buildErrorMessage(url: string, status: number, statusText: string, text: string) {
  return formatApiErrorText(text, `Request failed (${status} ${statusText || ''})`.trim());
}

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
    throw new Error(buildErrorMessage(url, res.status, res.statusText, text));
  }

  return text ? JSON.parse(text) : ({} as T);
}
