import { STAFFING_API_BASE_URL } from '@/lib/api-base';

export type StaffingUserRole =
  | 'PROFESSIONAL'
  | 'FACILITY_ADMIN'
  | 'INTERNAL_ADMIN';

export type StaffingUser = {
  id: string;
  email: string;
  role: StaffingUserRole;
  professionalId?: string | null;
  facilityId?: string | null;
  facilityName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type AuthMeResponse = {
  data: {
    userId: string;
    email: string;
    role: 'PROFESSIONAL' | 'FACILITY_ADMIN' | 'FACILITY_STAFF' | 'INTERNAL_ADMIN';
    employeeId?: string | null;
    facilityId?: string | null;
    facilityName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    professionalId?: string | null;
    notificationEmail?: string | null;
    appNotificationsEnabled: boolean;
  };
  mustChangePassword?: boolean;
};

export type LoginResponse = {
  data: StaffingUser;
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

return parseResponse<LoginResponse>(res);
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
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  openShiftAlertsEnabled?: boolean;
  openShiftAlertRadiusMiles?: number;
  role: 'CNA' | 'LVN' | 'RN';
  city?: string;
  state?: string;
  zipCode?: string;
  turnstileToken: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/register-professional`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

return parseResponse<any>(res);
}

export async function registerFacilityRequest(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode: string;
  turnstileToken: string;
}) {
  const res = await fetch(`${STAFFING_API_BASE_URL}/api/auth/register-facility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

return parseResponse<any>(res);
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
