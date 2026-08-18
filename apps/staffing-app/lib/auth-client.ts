import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { Preferences } from '@capacitor/preferences';

export type StaffingUserRole =
  | 'PROFESSIONAL'
  | 'FACILITY_ADMIN'
  | 'FACILITY_STAFF'
  | 'INTERNAL_ADMIN';

export type StaffingUser = {
  id?: string;
  userId?: string;
  email?: string;
  role: StaffingUserRole;
  professionalId?: string | null;
  facilityId?: string | null;
  facilityName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  token?: string;
};

export type AuthMeResponse = {
  data: {
    userId: string;
    email: string;
    role: StaffingUserRole;
    employeeId?: string | null;
    facilityId?: string | null;
    facilityName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    professionalId?: string | null;
  };
  mustChangePassword?: boolean;
};

export type LoginResponse = {
  data: StaffingUser;
};

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('wezen_auth_token');
}

async function getStoredAuthToken() {
  if (typeof window === 'undefined') return null;

  const localToken = window.localStorage.getItem('wezen_auth_token');
  if (localToken) return localToken;

  try {
    const pref = await Preferences.get({ key: 'wezen_auth_token' });
    if (pref.value) {
      window.localStorage.setItem('wezen_auth_token', pref.value);
      return pref.value;
    }
  } catch {
    // Ignore preference read failures.
  }

  return null;
}

async function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('wezen_auth_token', token);
  try {
    await Preferences.set({ key: 'wezen_auth_token', value: token });
  } catch {
    // Ignore preference write failures.
  }
}

export async function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('wezen_auth_token');
  }
  try {
    await Preferences.remove({ key: 'wezen_auth_token' });
  } catch {
    // Ignore preference remove failures.
  }
}

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

  const parsed = await parseResponse<LoginResponse>(res);

  if (parsed.data.token && typeof window !== 'undefined') {
    await setStoredAuthToken(parsed.data.token);
  }

  return parsed;
}

export async function logoutRequest() {
  const token = await getStoredAuthToken();

  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  await clearAuthToken();

  if (!res.ok) {
    throw new Error('Logout failed');
  }
}

export async function meRequest(): Promise<AuthMeResponse> {
  const token = await getStoredAuthToken();

  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return parseResponse<AuthMeResponse>(res);
}

export async function registerProfessionalRequest(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  openShiftAlertsEnabled?: boolean;
  openShiftAlertRadiusMiles?: number;
  role: 'CNA' | 'LVN' | 'RN';
  city?: string;
  state?: string;
  zipCode?: string;
  ssnLast4: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/register-professional`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const parsed = await parseResponse<any>(res);

  if (parsed?.data?.token && typeof window !== 'undefined') {
    await setStoredAuthToken(parsed.data.token);
  }

  return parsed;
}

export async function registerFacilityRequest(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/register-facility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const parsed = await parseResponse<any>(res);

  if (parsed?.data?.token && typeof window !== 'undefined') {
    await setStoredAuthToken(parsed.data.token);
  }

  return parsed;
}


export async function forgotPasswordRequest(email: string) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  return parseResponse<{ ok: boolean }>(res);
}

export async function resetPasswordRequest(token: string, newPassword: string) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, newPassword }),
  });

  return parseResponse<{ ok: boolean }>(res);
}
