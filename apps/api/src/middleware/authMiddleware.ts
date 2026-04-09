import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { readAuthToken } from "../auth";

export type AppUserRole =
  | "SUPER_ADMIN"
  | "PAYROLL_ADMIN"
  | "HR_ADMIN"
  | "EMPLOYEE";

export interface AuthUser {
  id: string;
  role: AppUserRole;
  employeeId?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = readAuthToken(req);

    if (!token) {
      const auth = String(req.headers.authorization || "");
      if (auth.toLowerCase().startsWith("bearer ")) {
        token = auth.slice(7).trim();
      }
    }

    token = String(token || "").replace(/[\u0000-\u001F\u007F]/g, "");

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET not set");
      return res.status(500).json({ error: "Server auth misconfigured" });
    }
    console.log("AUTH DEBUG", {
  hasCookieToken: Boolean(readAuthToken(req)),
  hasBearer: String(req.headers.authorization || "").toLowerCase().startsWith("bearer "),
  cookieName: process.env.AUTH_COOKIE_NAME || "wezen_auth",
  nodeEnv: process.env.NODE_ENV,
  cookieDomain: process.env.COOKIE_DOMAIN || null,
  tokenPrefix: String(token || "").slice(0, 12),
});
    const payload = jwt.verify(token, secret) as any;

    const id = String(payload.sub || payload.id || payload.userId || "").trim();
    const role = String(payload.role || "").trim().toUpperCase() as AppUserRole;
    const employeeId =
      payload.employeeId == null ? null : String(payload.employeeId);

    if (!id) {
      return res.status(401).json({ error: "Invalid token (no user id)" });
    }

    if (
      role !== "SUPER_ADMIN" &&
      role !== "PAYROLL_ADMIN" &&
      role !== "HR_ADMIN" &&
      role !== "EMPLOYEE"
    ) {
      return res.status(401).json({ error: "Invalid token (bad role)" });
    }

    req.user = {
      id,
      role,
      employeeId,
    };

    return next();
  } catch (err: any) {
    console.error("JWT verify failed:", err?.name, err?.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...allowedRoles: AppUserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole("SUPER_ADMIN", "PAYROLL_ADMIN", "HR_ADMIN")(req, res, next);
}
