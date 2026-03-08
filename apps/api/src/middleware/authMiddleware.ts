import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "SUPER_ADMIN" | "EMPLOYEE";
  };
}

export function requireAuth(req: any, res: any, next: any) {
  try {
    const auth = String(req.headers.authorization || "");
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }

    // 1) extract token
    let token = auth.slice(7).trim();

    // 2) remove hidden control characters (can appear from copy/paste or bad storage)
    token = token.replace(/[\u0000-\u001F\u007F]/g, "");

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET not set");
      return res.status(500).json({ error: "Server auth misconfigured" });
    }

    // ✅ DO NOT JSON.parse(Buffer.from(...)) etc
    const payload = jwt.verify(token, secret) as any;
    const id = String(payload.id || payload.userId || payload.sub || "");
if (!id) return res.status(401).json({ error: "Invalid token (no user id)" });

req.user = {
  ...payload,
  id,                 // ✅ normalize
};

return next();
    // attach to req for downstream routes
    req.user = payload;

    return next();
  } catch (err: any) {
    console.error("JWT verify failed:", err?.name, err?.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role;

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Admin only" });
  }

  next();
}
