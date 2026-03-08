import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string; // userId
  role: "ADMIN" | "EMPLOYEE";
  employeeId?: string | null;
};

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
