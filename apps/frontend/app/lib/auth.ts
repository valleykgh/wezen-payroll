export type Role = "ADMIN" | "SUPER_ADMIN" | "PAYROLL_ADMIN" | "HR_ADMIN" | "EMPLOYEE";

export type AuthedUser = {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  mustChangePassword?: boolean;
};

const USER_KEY = "payroll_user";

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

export function logoutLocal() {
  clearUser();
}

export function setSession(user: AuthedUser) {
  setUser(user);
}
