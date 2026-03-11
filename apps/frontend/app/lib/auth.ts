// apps/frontend/app/lib/auth.ts

export type Role = "ADMIN" | "SUPER_ADMIN" | "PAYROLL_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
export type AuthedUser = {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  mustChangePassword?: boolean;
};

const TOKEN_KEY = "payroll_token";
const USER_KEY = "payroll_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): AuthedUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthedUser;
  } catch {
    return null;
  }
}

export function setUser(user: AuthedUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function logout() {
  clearToken();
  clearUser();
}

export function setSession(token: string, user: AuthedUser) {
  setToken(token);
  setUser(user);
}
