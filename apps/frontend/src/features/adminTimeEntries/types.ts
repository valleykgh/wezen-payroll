export type Punch = { clockIn: string; clockOut: string };
export type Break = { startTime: string; endTime: string };

export type TimeEntry = {
  id: string;
  employeeId: string;
  facilityId: string;
  workDate: string;
  status: "DRAFT" | "APPROVED" | "LOCKED";
  shiftType: "AM" | "PM" | "NOC";
  minutesWorked: number;
  breakMinutes: number;

  punchesJson: Punch[] | null;
  breaksJson: Break[] | null;

  employee?: {
    id: string;
    legalName: string;
    preferredName: string | null;
    email: string;
    hourlyRateCents: number;
    billingRole: string | null;
  };

  facility?: { id: string; name: string };
};
