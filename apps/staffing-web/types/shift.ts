export type RoleType = 'CNA' | 'LVN' | 'RN';
export type ShiftType = 'AM' | 'PM' | 'NOC';
export type ShiftStatus = 'AVAILABLE' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'FILLED';

export type MarketplaceShift = {
  id: string;
  role: RoleType;
  facilityName: string;
  city: string;
  state: string;
  distanceMiles: number;
  shiftType: ShiftType;
  date: string;
  time: string;
  payRateLabel: string;
  applicants: number;
  status: ShiftStatus;
};

export type ShiftFilterOptions = {
  roles: RoleType[];
  shiftTypes: ShiftType[];
  radii: string[];
};
