import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

type AppRole = 'PROFESSIONAL' | 'FACILITY_ADMIN' | 'INTERNAL_ADMIN';

export type AuthUser = {
  userId: string;
  role: AppRole;
};

export type AuthedRequest = Request & {
  authUser?: AuthUser;
};

const AUTH_COOKIE_NAME = 'wezen_auth';

export function readAuthUser(req: Request): AuthUser | null {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) return null;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as AuthUser;

    if (!decoded?.userId || !decoded?.role) {
      return null;
    }

    return {
      userId: decoded.userId,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authUser = readAuthUser(req);

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.authUser = authUser;
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const authUser = readAuthUser(req);

    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(authUser.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.authUser = authUser;
    next();
  };
}
