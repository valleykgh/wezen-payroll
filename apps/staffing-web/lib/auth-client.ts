import { STAFFING_API_BASE_URL } from '@/lib/api-base';
export type AuthMeResponse = {
  data: {
    userId: string;
    email: string;
    role: 'FACILITY_ADMIN' | 'PROFESSIONAL' | 'INTERNAL_ADMIN';
    firstName?: string | null;
    lastName?: string | null;
    professionalId?: string | null;
    facilityId?: string | null;
    facilityName?: string | null;
  };
};

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || 'Request failed');
  }

  return text ? JSON.parse(text) : ({} as T);
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  return parseResponse(res);
}

export async function logoutRequest() {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Logout failed');
  }
}

export async function meRequest(): Promise<AuthMeResponse> {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  return parseResponse<AuthMeResponse>(res);
}

export async function registerProfessionalRequest(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'CNA' | 'LVN' | 'RN';
  city?: string;
  state?: string;
  zipCode?: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/register-professional`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

export async function registerFacilityRequest(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}}/api/auth/register-facility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}
