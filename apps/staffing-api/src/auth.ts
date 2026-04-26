import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
}
const COOKIE_NAME = 'wezen_auth';

export type AuthTokenPayload = {
  userId: string;
  role: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d',
  });
}

export function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(process.env.AUTH_COOKIE_NAME || 'wezen_auth', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(process.env.AUTH_COOKIE_NAME || 'wezen_auth', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
  });
}
export function readAuthToken(req: Request) {
  return req.cookies?.[COOKIE_NAME] || '';
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

export type AuthedRequest = Request & {
  auth?: AuthTokenPayload;
};

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = readAuthToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  req.auth = payload;
  next();
}

export function requireRole(role: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.auth.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}
