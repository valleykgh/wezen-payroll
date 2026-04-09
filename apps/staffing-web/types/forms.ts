import type { RoleType, ShiftType } from './shift';

export type PostShiftFormValues = {
  role: RoleType;
  shiftType: ShiftType;
  date: string;
  workersNeeded: number;
  startTime: string;
  endTime: string;
  instructions: string;
};
