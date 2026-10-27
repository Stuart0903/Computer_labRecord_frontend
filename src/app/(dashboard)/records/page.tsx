'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'react-hot-toast';
import {
  ClipboardList,
  Search,
  Save,
  Loader2,
  ShieldCheck,
  Clock,
  Filter,
  X,
} from 'lucide-react';
import type { LabRecord, LabSession } from '@/lib/types';
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
import { autoCalcMarks, isAbsentStatus, rowClassForStatus } from '@/lib/marks'
import { format } from 'date-fns';

export default function RecordsPage() {
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalShown, setTotalShown] = useState(0);

  // Filters
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterSession, setFilterSession] = useState<string>('all');
  const [filterTask, setFilterTask] = useState<string>('all');
  const [filterVerified, setFilterVerified] = useState<string>('all');
  const [filterAttendance, setFilterAttendance] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkField, setBulkField] = useState<'taskStatus' | 'verified' | 'attendance'>('taskStatus');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    loadRecords();
  }, [filterClass, filterSection, filterSession, filterTask, filterVerified, filterAttendance, filterDateFrom, filterDateTo, filterSearch]);

  async function loadSessions() {
    try {
      const data = await api<LabSession[]>('/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }

  async function loadRecords() {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (filterClass !== 'all') params.set('class', filterClass);
      if (filterSection !== 'all') params.set('section', filterSection);
      if (filterSession !== 'all') params.set('sessionId', filterSession);
      if (filterTask !== 'all') params.set('taskStatus', filterTask);
      if (filterVerified !== 'all') params.set('verified', filterVerified);
      if (filterAttendance !== 'all') params.set('attendance', filterAttendance);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (filterSearch) params.set('search', filterSearch);
      params.set('limit', '200');
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<LabRecord[]>(`/records${query}`);
      setRecords(data);
      setTotalShown(data.length);
    } catch (err) {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRecord(recordId: string, field: string, value: unknown) {
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
      loadRecords();
    }
  }

  /**
   * Handle the Verify button click. Toggles Verified ↔ Pending.
   * When transitioning TO Verified, also auto-fill marks if:
   *   - the student is NOT absent (absent students are not graded)
   *   - marks is currently null (preserve manual edits)
   *   - maxMarks is set
   */
  async function handleVerify(record: LabRecord) {
    const newVerified = record.verified === 'Verified' ? 'Pending' : 'Verified';

    let newMarks = record.marks;
    if (
      newVerified === 'Verified' &&
      record.marks === null &&
      record.maxMarks &&
      !isAbsentStatus(record.attendance)
    ) {
      newMarks = autoCalcMarks(record.taskStatus, record.maxMarks);
    }

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
        toast.success(`Auto-filled ${newMarks}/${record.maxMarks} for ${record.student?.name || record.studentId}`);
      }
    } catch (err) {
      toast.error('Failed to save');
      loadRecords();
    }
  }

  /**
   * Handle attendance dropdown change.
   * When marking Absent or Bunk, also cascade: taskStatus → 'Not Done',
   * marks → null. Otherwise just update attendance.
   */
  async function handleAttendanceChange(record: LabRecord, newAttendance: string) {
    if (isAbsentStatus(newAttendance)) {
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
        loadRecords();
      }
    } else {
      handleUpdateRecord(record.id, 'attendance', newAttendance);
    }
  }

  function handleToggleMaterial(recordId: string, material: string, currentBrought: Record<string, boolean> | null) {
    const updated = { ...(currentBrought || {}) };
    updated[material] = !updated[material];
    handleUpdateRecord(recordId, 'materialsBrought', updated);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  }

  async function handleBulkByIds() {
    if (selectedIds.size === 0 || !bulkValue) return;
    setBulkLoading(true);
    try {
      await api<{ updated: number }>('/records', {
        method: 'PUT',
        body: { ids: Array.from(selectedIds), [bulkField]: bulkValue },
      });
      toast.success(`Updated ${selectedIds.size} records`);
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      loadRecords();
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkBySession() {
    if (!filterSession || filterSession === 'all' || !bulkValue) return;
    setBulkLoading(true);
    try {
      const result = await api<{ updated: number }>('/records/bulk', {
        method: 'POST',
        body: { sessionId: filterSession, [bulkField]: bulkValue },
      });
      toast.success(`Updated ${result.updated} records`);
      setBulkDialogOpen(false);
      loadRecords();
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  function clearFilters() {
    setFilterClass('all');
    setFilterSection('all');
    setFilterSession('all');
    setFilterTask('all');
    setFilterVerified('all');
    setFilterAttendance('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSearch('');
    setSearchInput('');
  }

  const hasFilters = filterClass !== 'all' || filterSection !== 'all' || filterSession !== 'all' ||
    filterTask !== 'all' || filterVerified !== 'all' || filterAttendance !== 'all' ||
    filterDateFrom || filterDateTo || filterSearch;

  // Get unique materials across visible records
  const allMaterials = [...new Set(
    records.flatMap((r) => r.materialsBrought ? Object.keys(r.materialsBrought) : [])
  )];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Records</h1>
          <p className="text-slate-500 mt-1">{totalShown} records</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Save className="mr-2 h-4 w-4" /> Bulk Update ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={filterClass} onValueChange={(val) => { setFilterClass(val ?? 'all'); setFilterSection('all'); }}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CLASSES.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section</Label>
              <Select value={filterSection} onValueChange={(val) => setFilterSection(val ?? 'all')}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SECTIONS.map((s) => <SelectItem key={s} value={s}>Sec {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Session</Label>
              <Select value={filterSession} onValueChange={(val) => setFilterSession(val ?? 'all')}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.class}-{s.section} {format(new Date(s.date), 'dd MMM')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Task</Label>
              <Select value={filterTask} onValueChange={(val) => setFilterTask(val ?? 'all')}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Attendance</Label>
              <Select value={filterAttendance} onValueChange={(val) => setFilterAttendance(val ?? 'all')}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Verified</Label>
              <Select value={filterVerified} onValueChange={(val) => setFilterVerified(val ?? 'all')}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {VERIFIED_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Search</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, ID..."
                  onKeyDown={(e) => e.key === 'Enter' && setFilterSearch(searchInput)}
                  className="h-8 text-xs"
                />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFilterSearch(searchInput)}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">No records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="p-3 font-medium w-10">
                      <Checkbox checked={selectedIds.size === records.length && records.length > 0} onCheckedChange={toggleSelectAll} />
                    </th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Roll</th>
                    <th className="p-3 font-medium">Student</th>
                    <th className="p-3 font-medium">Topic</th>
                    <th className="p-3 font-medium w-28">Attendance</th>
                    <th className="p-3 font-medium w-32">Task</th>
                    {allMaterials.map((mat) => (
                      <th key={mat} className="p-3 font-medium w-20">{mat}</th>
                    ))}
                    <th className="p-3 font-medium w-18">Marks</th>
                    <th className="p-3 font-medium w-20">Verified</th>
                    <th className="p-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={`border-b last:border-0 ${rowClassForStatus(record.taskStatus, record.attendance)}`}
                    >
                      <td className="p-3">
                        <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={() => toggleSelect(record.id)} />
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-600">
                        {record.session ? format(new Date(record.session.date), 'dd MMM yy') : '—'}
                      </td>
                      <td className="p-3 font-medium">{record.rollNo}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-slate-900">{record.student?.name || record.studentId}</p>
                          <p className="text-xs text-slate-500 font-mono">{record.studentId}</p>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 max-w-[120px] truncate">{record.session?.topic || '—'}</td>

                      {/* Attendance */}
                      <td className="p-3">
                        <Select value={record.attendance} onValueChange={(val) => {
                          if (val !== null) handleAttendanceChange(record, val);
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`${ATTENDANCE_COLORS[s]} text-[10px]`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Task */}
                      <td className="p-3">
                        <Select value={record.taskStatus} onValueChange={(val) => handleUpdateRecord(record.id, 'taskStatus', val)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`${TASK_STATUS_COLORS[s]} text-[10px]`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Material Toggles */}
                      {allMaterials.map((mat) => {
                        const brought = record.materialsBrought?.[mat];
                        return (
                          <td key={mat} className="p-3">
                            {brought !== undefined ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 text-xs px-1 ${brought ? 'text-emerald-700' : 'text-red-600'}`}
                                onClick={() => handleToggleMaterial(record.id, mat, record.materialsBrought)}
                              >
                                {brought ? '✓' : '✗'}
                              </Button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Marks */}
                      <td className="p-3">
                        <div className="flex items-center gap-0.5">
                          <Input
                            type="number"
                            min={0}
                            max={record.maxMarks || 999}
                            value={record.marks !== null ? record.marks : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecords((prev) =>
                                prev.map((r) => r.id === record.id ? { ...r, marks: val === '' ? null : Number(val) } : r)
                              );
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              handleUpdateRecord(record.id, 'marks', val ==='' ? null : Number(val));
                            }}
                            placeholder="—"
                            className="h-7 text-xs w-12"
                          />
                          <span className="text-[10px] text-slate-400">/{record.maxMarks || '—'}</span>
                        </div>
                      </td>

                      {/* Verified */}
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs px-1 ${record.verified === 'Verified' ? 'text-emerald-700' : 'text-amber-700'}`}
                          onClick={() => handleVerify(record)}
                          title={record.verified === 'Pending' ? 'Verify (auto-fills marks if empty)' : 'Unverify'}
                        >
                          {record.verified === 'Verified' ? (
                            <><ShieldCheck className="mr-1 h-3 w-3" />V</>
                          ) : (
                            <><Clock className="mr-1 h-3 w-3" />P</>
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
                          className="h-7 text-xs w-24"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0 ? `Update ${selectedIds.size} selected records` : 'Update all records in this session'}
            </DialogDescription>
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
            {selectedIds.size > 0 ? (
              <Button onClick={handleBulkByIds} disabled={!bulkValue || bulkLoading}>
                {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update {selectedIds.size} Selected
              </Button>
            ) : (
              <Button onClick={handleBulkBySession} disabled={!bulkValue || bulkLoading || filterSession === 'all'}>
                {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update All in Session
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}