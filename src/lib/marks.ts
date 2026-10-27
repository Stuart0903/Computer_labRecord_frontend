/**
 * Shared marks helpers for the records / new-session pages.
 *
 * Auto-fill rules (used when teacher clicks Verify, only if marks is null):
 *   Completed            → full marks (maxMarks)
 *   Partially Completed  → Math.round(maxMarks / 2)   (15 → 8, 10 → 5)
 *   Not Completed        → 0
 *   Not Done             → 0
 *
 * Manual edits are preserved — auto-fill only fires when marks is null.
 */

const TASK_MARKS_RULE: Record<string, (maxMarks: number) => number> = {
  Completed: (m) => m,
  'Partially Completed': (m) => Math.round(m / 2),
  'Not Completed': () => 0,
  'Not Done': () => 0,
};

/**
 * Compute auto-fill marks for a record based on its task status and maxMarks.
 * Returns null when the rule isn't applicable (unknown status, no maxMarks,
 * or maxMarks < 1).
 */
export function autoCalcMarks(
  taskStatus: string,
  maxMarks: number | null | undefined,
): number | null {
  if (!maxMarks || maxMarks < 1) return null;
  const rule = TASK_MARKS_RULE[taskStatus];
  if (!rule) return null;
  return rule(maxMarks);
}

/**
 * Whether this attendance status means the student was not in class.
 * Such students are NOT graded on verify (marks left blank).
 */
export function isAbsentStatus(attendance: string | null | undefined): boolean {
  return attendance === 'Absent' || attendance === 'Bunk';
}

/**
 * Subtle row tint (Tailwind class) for the records table based on task status.
 * Returns the Tailwind class to apply to <tr className=...>.
 */
export function rowClassForStatus(
  taskStatus: string,
  attendance: string | null | undefined,
): string {
  // Absent students get a muted gray to make them visually distinct.
  if (isAbsentStatus(attendance)) return 'bg-slate-100/60';

  switch (taskStatus) {
    case 'Completed':
      return 'bg-emerald-50/40 hover:bg-emerald-50/70';
    case 'Partially Completed':
      return 'bg-amber-50/40 hover:bg-amber-50/70';
    case 'Not Completed':
      return 'bg-red-50/40 hover:bg-red-50/70';
    case 'Not Done':
      return 'bg-slate-50/60 hover:bg-slate-100/70';
    default:
      return 'hover:bg-slate-50/50';
  }
}
