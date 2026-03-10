import "express";

declare global {
  namespace Express {
    interface UserPayload {
      sub?: string;
      id?: string;
      role?: string;
      employeeId?: string | null;
      email?: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
