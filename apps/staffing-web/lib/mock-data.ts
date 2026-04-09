import type { MarketplaceShift, ShiftFilterOptions } from '@/types/shift';

export const facilityDashboardStats = [
  { label: 'Open Shifts', value: '18', helper: 'Live now', tone: 'info' as const },
  { label: 'Pending Applicants', value: '24', helper: 'Needs review', tone: 'warning' as const },
  { label: 'Compliance Alerts', value: '4', helper: 'Action needed', tone: 'danger' as const },
  { label: 'Filled This Week', value: '31', helper: 'On track', tone: 'success' as const },
];

export const recentFacilityShifts = [
  {
    id: 'S-1001',
    role: 'CNA',
    shiftType: 'AM',
    date: 'Apr 4, 2026',
    location: 'Sunrise Care Center',
    status: 'Open',
    applicants: 6,
  },
  {
    id: 'S-1002',
    role: 'LVN',
    shiftType: 'PM',
    date: 'Apr 4, 2026',
    location: 'Mission Ridge Rehab',
    status: 'Pending',
    applicants: 3,
  },
  {
    id: 'S-1003',
    role: 'RN',
    shiftType: 'NOC',
    date: 'Apr 5, 2026',
    location: 'Northview Hospital',
    status: 'Filled',
    applicants: 7,
  },
];

export const workerDashboardStats = [
  { label: 'Profile Status', value: 'Approved', helper: 'Ready to work', tone: 'success' as const },
  { label: 'Documents', value: '2 Missing', helper: 'Complete soon', tone: 'warning' as const },
  { label: 'My Requests', value: '5', helper: '2 pending', tone: 'info' as const },
  { label: 'Upcoming Shifts', value: '3', helper: 'This week', tone: 'default' as const },
];

export const workerUpcomingShifts = [
  {
    id: 'W-2001',
    role: 'LVN',
    facility: 'Valley Care Center',
    shiftType: 'PM',
    date: 'Apr 3, 2026',
    distance: '11 miles',
    status: 'Approved',
  },
  {
    id: 'W-2002',
    role: 'RN',
    facility: 'Northview Hospital',
    shiftType: 'NOC',
    date: 'Apr 5, 2026',
    distance: '19 miles',
    status: 'Approved',
  },
];

export const availableShiftFilters: ShiftFilterOptions = {
  roles: ['CNA', 'LVN', 'RN'],
  shiftTypes: ['AM', 'PM', 'NOC'],
  radii: ['5 miles', '10 miles', '25 miles', '50 miles'],
};

export const marketplaceShifts: MarketplaceShift[] = [
  {
    id: 'M-3001',
    role: 'CNA',
    facilityName: 'Sunrise Care Center',
    city: 'Fresno',
    state: 'CA',
    distanceMiles: 8,
    shiftType: 'AM',
    date: 'Apr 6, 2026',
    time: '7:00 AM - 3:00 PM',
    payRateLabel: '$26/hr',
    applicants: 4,
    status: 'AVAILABLE',
  },
  {
    id: 'M-3002',
    role: 'LVN',
    facilityName: 'Mission Ridge Rehab',
    city: 'Bakersfield',
    state: 'CA',
    distanceMiles: 14,
    shiftType: 'PM',
    date: 'Apr 6, 2026',
    time: '3:00 PM - 11:00 PM',
    payRateLabel: '$38/hr',
    applicants: 2,
    status: 'AVAILABLE',
  },
  {
    id: 'M-3003',
    role: 'RN',
    facilityName: 'Northview Hospital',
    city: 'Modesto',
    state: 'CA',
    distanceMiles: 22,
    shiftType: 'NOC',
    date: 'Apr 7, 2026',
    time: '11:00 PM - 7:00 AM',
    payRateLabel: '$54/hr',
    applicants: 6,
    status: 'AVAILABLE',
  },
  {
    id: 'M-3004',
    role: 'CNA',
    facilityName: 'Golden Meadow Skilled Nursing',
    city: 'Clovis',
    state: 'CA',
    distanceMiles: 11,
    shiftType: 'PM',
    date: 'Apr 7, 2026',
    time: '3:00 PM - 11:00 PM',
    payRateLabel: '$27/hr',
    applicants: 3,
    status: 'AVAILABLE',
  },
];
