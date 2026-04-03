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
