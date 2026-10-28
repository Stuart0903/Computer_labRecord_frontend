'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import {
  PlusCircle,
  Loader2,
  Save,
  CheckCircle2,
  ShieldCheck,
  Clock,
  UserCheck,
  Package,
  XCircle,
  Power,
} from 'lucide-react';
import type { LabSession, LabRecord } from '@/lib/types';
import {
  CLASSES,
  SECTIONS,
  TASK_STATUSES,
  VERIFIED_STATUSES,
  ATTENDANCE_STATUSES,
  TASK_STATUS_COLORS,
  VERIFIED_COLORS,
  ATTENDANCE_COLORS,
} from '@/lib/constants';
import { autoCalcMarks, isAbsentStatus, rowClassForStatus, applyMaterialsPenalty } from '@/lib/marks';
import { useActiveSession } from '@/lib/use-active-session';
import { format } from 'date-fns';

export default function NewSessionPage() {
  // Form state
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [topic, setTopic] = useState('');
  const [activity, setActivity] = useState('');
  const [learned, setLearned] = useState('');
  const [materialsRequired, setMaterialsRequired] = useState('');
  const [creating, setCreating] = useState(false);

  // Session state — persisted via useActiveSession hook so navigating away
  // and coming back restores the running session automatically.
  const {
    session,
    records,
    setRecords,
    activate,
    end: endSession,
    refreshRecords,
    restoring,
  } = useActiveSession();
  const [maxMarksInput, setMaxMarksInput] = useState<string>('10');

  // Bulk dialog (existing — applies to ALL students in session)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkField, setBulkField] = useState<'taskStatus' | 'verified' | 'attendance'>('taskStatus');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Roll-number multi-select for targeted bulk updates
  const [selectedRolls, setSelectedRolls] = useState<Set<number>>(new Set());
  const [rollBulkOpen, setRollBulkOpen] = useState(false);
  const [rollBulkField, setRollBulkField] = useState<'taskStatus' | 'verified' | 'attendance'>('taskStatus');
  const [rollBulkValue, setRollBulkValue] = useState('');
  const [rollBulkLoading, setRollBulkLoading] = useState(false);

  const isFormValid = selectedClass && selectedSection && topic && date;

  // Parse materials from session
  const materialsList: string[] = session?.materialsRequired
    ? session.materialsRequired.split(',').map(m => m.trim()).filter(m => m)
    : [];

  async function handleCreateSession() {
    if (!isFormValid) return;
    setCreating(true);
    try {
      const data = await api<LabSession>('/sessions', {
        method: 'POST',
        body: {
          date,
          class: Number(selectedClass),
          section: selectedSection,
          topic,
          activity: activity || undefined,
          learned: learned || undefined,
          materialsRequired: materialsRequired || undefined,
        },
      });
      activate(data);
      toast.success(`Session created with ${data.labRecords?.length || 0} student records`);
    } catch (err) {
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateRecord(
    recordId: string,
    field: string,
    value: unknown
  ) {
    // Optimistic update
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, [field]: value } : r))
    );

    try {
      const updated = await api<LabRecord>(`/records/${recordId}`, {
        method: 'PATCH',
        body: { [field]: value },
      });
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? updated : r))
      );
    } catch (err) {
      toast.error('Failed to save');
      refreshRecords();
    }
  }

  /**
   * Handle the Verify button click. Toggles Verified ↔ Pending.
   *
   * When transitioning TO Verified:
   *   - If the student is NOT absent
   *   - And maxMarks is set
   *   - And marks is currently NULL (i.e., we're auto-filling for the first time)
   *   → auto-fill marks based on task status, THEN apply materials penalty.
   *
   * If marks already has a value (teacher manually entered it, OR a previous
   * verify auto-filled it), we DON'T touch marks — just toggle verified.
   * This prevents the bug where Verify → Pending → Verify keeps deducting
   * the materials penalty over and over.
   *
   * Penalty is one-way: if a material is later toggled back to "brought",
   * marks are NOT restored. Teacher must re-enter manually if needed.
   */
  async function handleVerify(record: LabRecord) {
    const newVerified = record.verified === 'Verified' ? 'Pending' : 'Verified';

    let newMarks = record.marks;
    let penaltyApplied = 0;

    if (
      newVerified === 'Verified' &&
      !isAbsentStatus(record.attendance) &&
      record.maxMarks &&
      record.marks === null  // ← KEY FIX: only auto-fill + penalty when marks is null
    ) {
      // Step 1: auto-fill marks based on task status
      newMarks = autoCalcMarks(record.taskStatus, record.maxMarks);

      // Step 2: apply materials penalty (only if student has at least one
      // missing material AND auto-fill produced a positive number).
      if (newMarks !== null && newMarks > 0) {
        const result = applyMaterialsPenalty(
          newMarks,
          record.materialsBrought,
          record.maxMarks,
        );
        newMarks = result.marks;
        penaltyApplied = result.penaltyApplied;
      }
    }

    // Optimistic update
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              verified: newVerified,
              ...(newMarks !== record.marks ? { marks: newMarks } : {}),
            }
          : r
      )
    );

    try {
      const patchBody: Record<string, unknown> = { verified: newVerified };
      if (newMarks !== record.marks) patchBody.marks = newMarks;

      const updated = await api<LabRecord>(`/records/${record.id}`, {
        method: 'PATCH',
        body: patchBody,
      });
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));

      if (newVerified === 'Verified' && newMarks !== record.marks && newMarks !== null) {
        if (penaltyApplied > 0) {
          toast.success(
            `Verified ${record.student?.name || record.studentId}: ${newMarks}/${record.maxMarks} (-${penaltyApplied} materials penalty)`,
          );
        } else {
          toast.success(`Auto-filled ${newMarks}/${record.maxMarks} for ${record.student?.name || record.studentId}`);
        }
      }
    } catch (err) {
      toast.error('Failed to save');
      refreshRecords();
    }
  }

  /**
   * Handle attendance dropdown change.
   * When marking Absent or Bunk, also cascade: taskStatus → 'Not Done',
   * marks → null. Otherwise just update attendance.
   */
  async function handleAttendanceChange(record: LabRecord, newAttendance: string) {
    if (isAbsentStatus(newAttendance)) {
      // Cascade — three fields updated in one PATCH.
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, attendance: newAttendance, taskStatus: 'Not Done', marks: null }
            : r
        )
      );
      try {
        const updated = await api<LabRecord>(`/records/${record.id}`, {
          method: 'PATCH',
          body: {
            attendance: newAttendance,
            taskStatus: 'Not Done',
            marks: null,
          },
        });
        setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      } catch (err) {
        toast.error('Failed to save');
        refreshRecords();
      }
    } else {
      // Plain attendance change — no cascade.
      handleUpdateRecord(record.id, 'attendance', newAttendance);
    }
  }

  /**
   * Handle task-status dropdown change.
   * Cascade rules (per teacher's spec):
   *   - 'Not Completed' or 'Not Done' → marks = null + verified = 'Pending'
   *     (these students did not successfully complete the task, so any
   *      previously-assigned marks and verified flag are reset)
   *   - 'Completed' or 'Partially Completed' → no cascade (preserve marks
   *     and verified). Teacher must explicitly click Verify to auto-fill marks.
   */
  async function handleTaskStatusChange(record: LabRecord, newStatus: string) {
    const shouldReset = newStatus === 'Not Completed' || newStatus === 'Not Done';

    if (shouldReset) {
      // Cascade: marks → null, verified → Pending, taskStatus → newStatus
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, taskStatus: newStatus, marks: null, verified: 'Pending' }
            : r
        )
      );
      try {
        const updated = await api<LabRecord>(`/records/${record.id}`, {
          method: 'PATCH',
          body: {
            taskStatus: newStatus,
            marks: null,
            verified: 'Pending',
          },
        });
        setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      } catch (err) {
        toast.error('Failed to save');
        refreshRecords();
      }
    } else {
      // Plain task-status change — no cascade.
      handleUpdateRecord(record.id, 'taskStatus', newStatus);
    }
  }

  function handleToggleMaterial(recordId: string, material: string, currentBrought: Record<string, boolean> | null) {
    const updated = { ...(currentBrought || {}) };
    updated[material] = !updated[material];
    handleUpdateRecord(recordId, 'materialsBrought', updated);
  }

  async function handleBulkUpdate() {
    if (!session || !bulkValue) return;
    setBulkLoading(true);
    try {
      await api<{ updated: number }>('/records/bulk', {
        method: 'POST',
        body: {
          sessionId: session.id,
          [bulkField]: bulkValue,
        },
      });
      await refreshRecords();
      toast.success('All records updated');
      setBulkDialogOpen(false);
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  /**
   * Bulk update only the selected roll numbers (within the active session).
   * Uses PUT /records with `ids` — only those records get updated.
   */
  async function handleRollBulkUpdate() {
    if (!session || selectedRolls.size === 0 || !rollBulkValue) return;
    setRollBulkLoading(true);
    try {
      const ids = records
        .filter((r) => selectedRolls.has(r.rollNo))
        .map((r) => r.id);
      await api<{ updated: number }>('/records', {
        method: 'PUT',
        body: { ids, [rollBulkField]: rollBulkValue },
      });
      await refreshRecords();
      toast.success(`Updated ${ids.length} records`);
      setRollBulkOpen(false);
      setSelectedRolls(new Set());
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setRollBulkLoading(false);
    }
  }

  async function handleSetMaxMarksForAll() {
    if (!session || !maxMarksInput) return;
    const maxMarks = Number(maxMarksInput);
    if (isNaN(maxMarks) || maxMarks < 1) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        records.map((r) =>
          api(`/records/${r.id}`, {
            method: 'PATCH',
            body: { maxMarks },
          })
        )
      );
      setRecords((prev) => prev.map((r) => ({ ...r, maxMarks })));
      toast.success(`Max marks set to ${maxMarks} for all students`);
    } catch (err) {
      toast.error('Failed to set max marks');
    } finally {
      setBulkLoading(false);
    }
  }

  function handleNewSession() {
    // "End Session" — clears the persisted active session so the form
    // is shown again. The session itself remains in the database; the
    // teacher can find it later on the /records page.
    endSession();
    setSelectedClass('');
    setSelectedSection('');
    setTopic('');
    setActivity('');
    setLearned('');
    setMaterialsRequired('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedRolls(new Set());
  }

  // ─── RENDER ──────────────────────────────────────────────────

  if (restoring) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (session) {
    const completedCount = records.filter((r) => r.taskStatus === 'Completed').length;
    const verifiedCount = records.filter((r) => r.verified === 'Verified').length;
    const presentCount = records.filter((r) => r.attendance === 'Present').length;
    const forgotMaterialCount = records.filter((r) => {
      if (!r.materialsBrought) return false;
      return Object.values(r.materialsBrought).some(v => v === false);
    }).length;

    return (
      <div className="space-y-6">
        {/* Session Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mark Attendance</h1>
            <p className="text-slate-500 mt-1">
              {session.class}-{session.section} • {format(new Date(session.date), 'dd MMM yyyy')} • {session.topic}
            </p>
            {session.materialsRequired && (
              <p className="text-sm text-amber-700 mt-1">
                📋 Bring: {session.materialsRequired}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Save className="mr-2 h-4 w-4" />
              Bulk Update All
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('End this session? You can find it later under Records.')) {
                  handleNewSession();
                }
              }}
            >
              <Power className="mr-2 h-4 w-4" />
              End Session
            </Button>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            {records.length} Students
          </Badge>
          <Badge className="bg-emerald-100 text-emerald-800 text-sm py-1 px-3">
            <UserCheck className="mr-1 h-3.5 w-3.5" />
            {presentCount} Present
          </Badge>
          <Badge className="bg-emerald-100 text-emerald-800 text-sm py-1 px-3">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            {completedCount} Completed
          </Badge>
          {forgotMaterialCount > 0 && (
            <Badge className="bg-red-100 text-red-800 text-sm py-1 px-3">
              <Package className="mr-1 h-3.5 w-3.5" />
              {forgotMaterialCount} Forgot Material
            </Badge>
          )}
          <Badge className="bg-emerald-100 text-emerald-800 text-sm py-1 px-3">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {verifiedCount} Verified
          </Badge>
        </div>

        {/* Roll-Number Multi-Select + Targeted Bulk Update */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm whitespace-nowrap font-semibold">Selected rolls:</Label>
              <span className="text-sm font-medium text-blue-700">
                {selectedRolls.size === 0
                  ? 'None'
                  : `${selectedRolls.size} selected`}
              </span>

              {/* Popover to pick roll numbers */}
              <Popover>
                <PopoverTrigger className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                  Select Roll Numbers
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Pick roll numbers</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setSelectedRolls(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                  {/* Quick-select buttons */}
                  <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedRolls(new Set(records.map((r) => r.rollNo)))}
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() =>
                        setSelectedRolls(
                          new Set(records.filter((r) => r.attendance === 'Present').map((r) => r.rollNo))
                        )
                      }
                    >
                      Present only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() =>
                        setSelectedRolls(
                          new Set(
                            records.filter((r) => r.taskStatus === 'Not Completed' || r.taskStatus === 'Not Done').map((r) => r.rollNo)
                          )
                        )
                      }
                    >
                      Incomplete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() =>
                        setSelectedRolls(
                          new Set(records.filter((r) => r.verified === 'Pending').map((r) => r.rollNo))
                        )
                      }
                    >
                      Unverified
                    </Button>
                  </div>
                  {/* Individual checkboxes per roll number */}
                  <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
                    {records.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs cursor-pointer ${
                          selectedRolls.has(r.rollNo)
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <Checkbox
                          checked={selectedRolls.has(r.rollNo)}
                          onCheckedChange={(checked) => {
                            setSelectedRolls((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(r.rollNo);
                              else next.delete(r.rollNo);
                              return next;
                            });
                          }}
                        />
                        <span>{r.rollNo}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* If some are selected, show a "Bulk Update Selected" button */}
              {selectedRolls.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setRollBulkOpen(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  Bulk Update {selectedRolls.size} Selected
                </Button>
              )}

              {/* Clear-selection shortcut */}
              {selectedRolls.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setSelectedRolls(new Set())}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Max Marks Setter */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Max Marks for this session:</Label>
              <Input
                type="number"
                min={1}
                value={maxMarksInput}
                onChange={(e) => setMaxMarksInput(e.target.value)}
                className="w-20 h-8 text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleSetMaxMarksForAll} disabled={bulkLoading}>
                Apply to All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="p-3 font-medium w-12">Roll</th>
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium w-32">Attendance</th>
                    <th className="p-3 font-medium w-36">Task</th>
                    {materialsList.map((mat) => (
                      <th key={mat} className="p-3 font-medium w-28">{mat}</th>
                    ))}
                    <th className="p-3 font-medium w-24">Marks</th>
                    <th className="p-3 font-medium w-24">Verified</th>
                    <th className="p-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={`border-b last:border-0 ${rowClassForStatus(record.taskStatus, record.attendance)}`}
                    >
                      <td className="p-3 font-medium text-slate-700">{record.rollNo}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">{record.studentId}</Badge>
                      </td>
                      <td className="p-3 text-slate-900">{record.student?.name || record.studentId}</td>

                      {/* Attendance */}
                      <td className="p-3">
                        <Select
                          value={record.attendance}
                          onValueChange={(val) => {
                            if (val !== null) handleAttendanceChange(record, val);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`${ATTENDANCE_COLORS[s]} mr-1`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Task Status */}
                      <td className="p-3">
                        <Select
                          value={record.taskStatus}
                          onValueChange={(val) => {
                            if (val !== null) handleTaskStatusChange(record, val);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`${TASK_STATUS_COLORS[s]} mr-1`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Material Toggles */}
                      {materialsList.map((mat) => {
                        const brought = record.materialsBrought?.[mat] ?? true;
                        return (
                          <td key={mat} className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs px-2 ${brought ? 'text-emerald-700' : 'text-red-600'}`}
                              onClick={() => handleToggleMaterial(record.id, mat, record.materialsBrought)}
                            >
                              {brought ? '✓' : '✗'}
                            </Button>
                          </td>
                        );
                      })}

                      {/* Marks */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={record.maxMarks || 999}
                            value={record.marks !== null ? record.marks : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecords((prev) =>
                                prev.map((r) =>
                                  r.id === record.id ? { ...r, marks: val === '' ? null : Number(val) } : r
                                )
                              );
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              handleUpdateRecord(record.id, 'marks', val === '' ? null : Number(val));
                            }}
                            placeholder="—"
                            className="h-8 text-xs w-14"
                          />
                          <span className="text-xs text-slate-400">/{record.maxMarks || '—'}</span>
                        </div>
                      </td>

                      {/* Verified */}
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs px-2 ${record.verified === 'Verified' ? 'text-emerald-700' : 'text-amber-700'}`}
                          onClick={() => handleVerify(record)}
                          title={record.verified === 'Pending' ? 'Verify (auto-fills marks if empty)' : 'Unverify'}
                        >
                          {record.verified === 'Verified' ? (
                            <><ShieldCheck className="mr-1 h-3.5 w-3.5" /> V</>
                          ) : (
                            <><Clock className="mr-1 h-3.5 w-3.5" /> P</>
                          )}
                        </Button>
                      </td>

                      {/* Remarks */}
                      <td className="p-3">
                        <Input
                          value={record.remarks || ''}
                          onChange={(e) => {
                            setRecords((prev) =>
                              prev.map((r) => (r.id === record.id ? { ...r, remarks: e.target.value } : r))
                            );
                          }}
                          onBlur={(e) => handleUpdateRecord(record.id, 'remarks', e.target.value || null)}
                          placeholder="—"
                          className="h-8 text-xs w-28"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Update Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Update All Students</DialogTitle>
              <DialogDescription>Set a value for all {records.length} records in this session.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Field</Label>
                <Select value={bulkField} onValueChange={(val: any) => { setBulkField(val); setBulkValue(''); }}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="taskStatus">Task Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Select value={bulkValue} onValueChange={(val) => setBulkValue(val ?? 'all')}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select value" /></SelectTrigger>
                  <SelectContent>
                    {(bulkField === 'attendance'
                      ? ATTENDANCE_STATUSES
                      : bulkField === 'taskStatus'
                      ? TASK_STATUSES
                      : VERIFIED_STATUSES
                    ).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkUpdate} disabled={!bulkValue || bulkLoading}>
                {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Apply to All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Roll-number-targeted bulk update dialog */}
        <Dialog open={rollBulkOpen} onOpenChange={setRollBulkOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update {selectedRolls.size} Selected Students</DialogTitle>
              <DialogDescription>
                Applies to roll numbers: {Array.from(selectedRolls).sort((a, b) => a - b).join(', ')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Field</Label>
                <Select value={rollBulkField} onValueChange={(val: any) => { setRollBulkField(val); setRollBulkValue(''); }}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="taskStatus">Task Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Select value={rollBulkValue} onValueChange={(val) => setRollBulkValue(val ?? '')}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select value" /></SelectTrigger>
                  <SelectContent>
                    {(rollBulkField === 'attendance'
                      ? ATTENDANCE_STATUSES
                      : rollBulkField === 'taskStatus'
                      ? TASK_STATUSES
                      : VERIFIED_STATUSES
                    ).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRollBulkOpen(false)}>Cancel</Button>
              <Button onClick={handleRollBulkUpdate} disabled={!rollBulkValue || rollBulkLoading}>
                {rollBulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update {selectedRolls.size} Students
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── CREATION FORM ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Session</h1>
        <p className="text-slate-500 mt-1">Create a lab session and mark attendance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>Students will auto-load after you create the session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val ?? 'all')}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section *</Label>
              <Select value={selectedSection} onValueChange={(val) => setSelectedSection(val ?? 'all')}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Topic *</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Introduction to HTML" />
            </div>
            <div className="space-y-2">
              <Label>Activity</Label>
              <Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g. Creating a webpage" />
            </div>
            <div className="space-y-2">
              <Label>Materials Required</Label>
              <Input
                value={materialsRequired}
                onChange={(e) => setMaterialsRequired(e.target.value)}
                placeholder="e.g. Lab copy, Lab paper, Textbook"
              />
              <p className="text-xs text-slate-500">Comma-separated. Students will be marked per item.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>What We Learned</Label>
              <Textarea
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                placeholder="Summary of what students learned (visible to parents)"
                rows={3}
              />
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={handleCreateSession} disabled={!isFormValid || creating} size="lg">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Session...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Session
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}