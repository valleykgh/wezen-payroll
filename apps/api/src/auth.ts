import jwt from "jsonwebtoken";
import type { Response, Request } from "express";

export type JwtPayload = {
  sub: string;
  role: "SUPER_ADMIN" | "PAYROLL_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
  employeeId?: string | null;
};

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "wezen_auth";

export function signToken(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret) as JwtPayload;
}

export function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
}

export function readAuthToken(req: Request) {
  const cookieName = process.env.AUTH_COOKIE_NAME || "wezen_auth";
  return req.cookies?.[cookieName] || "";
}
