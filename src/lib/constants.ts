export const CLASSES = [6, 7, 8, 9, 10] as const;
export const SECTIONS = ['A', 'B', 'C', 'D'] as const;

export const TASK_STATUSES = ['Completed', 'Partially Completed', 'Not Completed', 'Not Done'] as const;
export const VERIFIED_STATUSES = ['Verified', 'Pending'] as const;
export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Bunk', 'Forgot Book'] as const;

export const TASK_STATUS_COLORS: Record<string, string> = {
  'Completed': 'bg-emerald-100 text-emerald-800',
  'Partially Completed': 'bg-amber-100 text-amber-800',
  'Not Completed': 'bg-red-100 text-red-800',
  'Not Done': 'bg-gray-100 text-gray-800',
};

export const VERIFIED_COLORS: Record<string, string> = {
  'Verified': 'bg-emerald-100 text-emerald-800',
  'Pending': 'bg-amber-100 text-amber-800',
};

export const ATTENDANCE_COLORS: Record<string, string> = {
  'Present': 'bg-emerald-100 text-emerald-800',
  'Absent': 'bg-red-100 text-red-800',
  'Bunk': 'bg-purple-100 text-purple-800',
  'Forgot Book': 'bg-amber-100 text-amber-800',
};

export const API_BASE = process.env.BACKEND_URL || '/api';
console.log(API_BASE)