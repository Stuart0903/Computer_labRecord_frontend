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

/* ============================================================================
   Materials-forgot penalty
   ----------------------------------------------------------------------------
   Rule: when a student has at least one material marked "missing" in their
   materialsBrought object, AND they get verified, deduct 10% of maxMarks
   from their marks (rounded to the nearest integer, min 0).

   Per the teacher's spec:
     • Penalty base: 10% of maxMarks (NOT of the student's actual marks)
     • Applied: ONLY on Verify click (not on every material toggle)
     • One-way: if a material is later toggled back to "brought", marks
       are NOT restored. Teacher must re-enter marks manually.
     • Skipped: absent/bunk students, students with no maxMarks set,
       students with null marks (no auto-fill happened).
============================================================================ */

/**
 * Returns true if the materialsBrought object has at least one missing
 * material (any key whose value is `false`).
 */
export function hasForgottenMaterial(
  materialsBrought: Record<string, boolean> | null | undefined,
): boolean {
  if (!materialsBrought) return false;
  return Object.values(materialsBrought).some((v) => v === false);
}

/**
 * Calculate the materials penalty for a record.
 * Returns the penalty amount (a non-negative integer), or 0 if not applicable.
 *
 *   penalty = round(maxMarks × 0.10)
 *
 * Examples:
 *   maxMarks=10, forgot 1 material → penalty = 1
 *   maxMarks=20, forgot 3 materials → penalty = 2  (10% of 20, same as 1 material)
 *   maxMarks=15, forgot 1 material → penalty = round(1.5) = 2
 *   maxMarks=5,  forgot 1 material → penalty = round(0.5) = 1 (rounds up)
 *   maxMarks=4,  forgot 1 material → penalty = round(0.4) = 0 (no deduction)
 */
export function computeMaterialsPenalty(
  materialsBrought: Record<string, boolean> | null | undefined,
  maxMarks: number | null | undefined,
): number {
  if (!hasForgottenMaterial(materialsBrought)) return 0;
  if (!maxMarks || maxMarks < 1) return 0;
  return Math.round(maxMarks * 0.1);
}

/**
 * Apply the materials penalty to a candidate marks value.
 * Used by handleVerify in records / new-session pages.
 *
 *   finalMarks = max(0, candidateMarks - penalty)
 *
 * Returns the same candidateMarks if no penalty applies.
 */
export function applyMaterialsPenalty(
  candidateMarks: number,
  materialsBrought: Record<string, boolean> | null | undefined,
  maxMarks: number | null | undefined,
): { marks: number; penaltyApplied: number } {
  const penalty = computeMaterialsPenalty(materialsBrought, maxMarks);
  if (penalty === 0) return { marks: candidateMarks, penaltyApplied: 0 };
  return {
    marks: Math.max(0, candidateMarks - penalty),
    penaltyApplied: penalty,
  };
}
