import { cookies } from 'next/headers';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import type { AuthMeResponse } from '@/lib/auth-client';

export async function meRequestServer(): Promise<AuthMeResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || 'Unauthorized');
  }

  return text ? JSON.parse(text) : ({} as AuthMeResponse);
}
