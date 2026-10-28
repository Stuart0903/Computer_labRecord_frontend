'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LabRecord, LabSession, PaginatedRecordsResult } from '@/lib/types';
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
import { format } from 'date-fns';

const PAGE_SIZE = 50;

export default function RecordsPage() {
  // useSearchParams() must be wrapped in <Suspense> in Next.js 16+.
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <RecordsPageInner />
    </Suspense>
  );
}

function RecordsPageInner() {
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Session dropdown search (so teacher can filter the session list inside
  // the dropdown after class+section cascading has narrowed it)
  const [sessionSearch, setSessionSearch] = useState('');

  // Pagination — 0-indexed page
  const [page, setPage] = useState(0);

  // Selection — preserved across pagination. IDs only, so changing pages
  // doesn't lose your bulk-update selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkField, setBulkField] = useState<'taskStatus' | 'verified' | 'attendance'>('taskStatus');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // ─── URL deep-link: ?sessionId=X (used by /sessions page "View Records" button) ──
  const searchParams = useSearchParams();
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId');
    if (sessionIdFromUrl) {
      setFilterSession(sessionIdFromUrl);
    }
  }, [searchParams]);

  // ─── Load sessions for the filter dropdown — cascaded by class+section ──
  // Only sessions matching the current class/section filters are loaded,
  // so the dropdown never has hundreds of items.
  useEffect(() => {
    loadSessions();
  }, [filterClass, filterSection]);

  async function loadSessions() {
    try {
      const params = new URLSearchParams();
      if (filterClass !== 'all') params.set('class', filterClass);
      if (filterSection !== 'all') params.set('section', filterSection);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<LabSession[]>(`/sessions${query}`);
      setSessions(data);
      // If the currently-selected session is no longer in the filtered list,
      // reset it to 'all' so the UI doesn't show a phantom selection.
      if (filterSession !== 'all' && !data.find((s) => s.id === filterSession)) {
        // Only reset if the URL deep-link isn't active (otherwise we'd
        // wipe the ?sessionId=X the user just deep-linked to).
        const urlSessionId = searchParams.get('sessionId');
        if (urlSessionId !== filterSession) {
          setFilterSession('all');
          setPage(0);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }

  // ─── Load records whenever any filter or page changes ──
  useEffect(() => {
    loadRecords();
  }, [filterClass, filterSection, filterSession, filterTask, filterVerified, filterAttendance, filterDateFrom, filterDateTo, filterSearch, page]);

  async function loadRecords() {
    setLoading(true);
    // Don't clear selection here — we want it preserved across page loads.
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
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const data = await api<PaginatedRecordsResult>(`/records?${params.toString()}`);
      setRecords(data.records);
      setTotal(data.total);
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

  async function handleVerify(record: LabRecord) {
    const newVerified = record.verified === 'Verified' ? 'Pending' : 'Verified';

    let newMarks = record.marks;
    let penaltyApplied = 0;

    if (
      newVerified === 'Verified' &&
      !isAbsentStatus(record.attendance) &&
      record.maxMarks
    ) {
      // Step 1: auto-fill if marks is null (preserve manual edits)
      if (record.marks === null) {
        newMarks = autoCalcMarks(record.taskStatus, record.maxMarks);
      }

      // Step 2: apply materials penalty (only on this verify transition,
      // only if student has at least one missing material).
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
        } else if (record.marks === null) {
          toast.success(`Auto-filled ${newMarks}/${record.maxMarks} for ${record.student?.name || record.studentId}`);
        }
      }
    } catch (err) {
      toast.error('Failed to save');
      loadRecords();
    }
  }

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

  async function handleTaskStatusChange(record: LabRecord, newStatus: string) {
    const shouldReset = newStatus === 'Not Completed' || newStatus === 'Not Done';
    if (shouldReset) {
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
        loadRecords();
      }
    } else {
      handleUpdateRecord(record.id, 'taskStatus', newStatus);
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
    // Select/deselect only the records on the CURRENT page (selection
    // from other pages is preserved).
    const pageIds = new Set(records.map((r) => r.id));
    const allOnPageSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
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
    setSessionSearch('');
    setPage(0);
  }

  const hasFilters =
    filterClass !== 'all' ||
    filterSection !== 'all' ||
    filterSession !== 'all' ||
    filterTask !== 'all' ||
    filterVerified !== 'all' ||
    filterAttendance !== 'all' ||
    filterDateFrom ||
    filterDateTo ||
    filterSearch;

  const allMaterials = useMemo(
    () => [...new Set(records.flatMap((r) => (r.materialsBrought ? Object.keys(r.materialsBrought) : [])))],
    [records]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  // Cascaded session list — already filtered by class+section from the
  // backend; further filter by the in-dropdown search text.
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter((s) =>
      s.topic.toLowerCase().includes(q) ||
      (s.activity || '').toLowerCase().includes(q)
    );
  }, [sessions, sessionSearch]);

  const allOnPageSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id));
  const someSelectedOffPage = selectedIds.size > records.filter((r) => selectedIds.has(r.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Records</h1>
          <p className="text-slate-500 mt-1">
            {total} total • showing {showingFrom}–{showingTo}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-blue-700 font-medium">• {selectedIds.size} selected</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
                <Save className="mr-2 h-4 w-4" /> Bulk Update ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear selection
              </Button>
            </>
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
              <Select
                value={filterClass}
                onValueChange={(val) => {
                  setFilterClass(val ?? 'all');
                  setFilterSection('all');
                  setFilterSession('all');
                  setPage(0);
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CLASSES.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section</Label>
              <Select
                value={filterSection}
                onValueChange={(val) => {
                  setFilterSection(val ?? 'all');
                  setFilterSession('all');
                  setPage(0);
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SECTIONS.map((s) => <SelectItem key={s} value={s}>Sec {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Session filter — cascaded + searchable popover */}
            <div className="col-span-2">
              <Label className="text-xs">Session</Label>
              <Popover>
                <PopoverTrigger
                  type="button"
                  role="combobox"
                  className="mt-1 flex h-8 w-full items-center justify-start rounded-md border border-input bg-background px-3 text-xs font-normal shadow-sm hover:bg-accent hover:text-accent-foreground"
                >
                    {filterSession === 'all' ? (
                      <span className="text-slate-500">All sessions</span>
                    ) : (
                      (() => {
                        const s = sessions.find((x) => x.id === filterSession);
                        return s ? (
                          <span className="truncate">
                            {s.class}-{s.section} • {format(new Date(s.date), 'dd MMM yy')} • {s.topic}
                          </span>
                        ) : (
                          <span className="text-slate-500">All sessions</span>
                        );
                      })()
                    )}
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      placeholder="Search session topic..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSession('all');
                        setPage(0);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${
                        filterSession === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : ''
                      }`}
                    >
                      All sessions (no filter)
                    </button>
                    {filteredSessions.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500 text-center">
                        No sessions match.
                        <br />
                        {filterClass === 'all' && filterSection === 'all'
                          ? 'Try picking a class first.'
                          : 'Try a different search.'}
                      </div>
                    ) : (
                      filteredSessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFilterSession(s.id);
                            setPage(0);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${
                            filterSession === s.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                          }`}
                        >
                          <div className="font-medium truncate">{s.topic}</div>
                          <div className="text-slate-500 mt-0.5">
                            {s.class}-{s.section} • {format(new Date(s.date), 'dd MMM yyyy')}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t text-[10px] text-slate-500">
                    {filterClass !== 'all' || filterSection !== 'all'
                      ? `Showing only ${filteredSessions.length} session(s) matching your class/section filters.`
                      : `${filteredSessions.length} sessions total. Pick a class to narrow down.`}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-xs">Task</Label>
              <Select value={filterTask} onValueChange={(val) => { setFilterTask(val ?? 'all'); setPage(0); }}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Attendance</Label>
              <Select value={filterAttendance} onValueChange={(val) => { setFilterAttendance(val ?? 'all'); setPage(0); }}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Verified</Label>
              <Select value={filterVerified} onValueChange={(val) => { setFilterVerified(val ?? 'all'); setPage(0); }}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {VERIFIED_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Search</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, ID..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilterSearch(searchInput);
                      setPage(0);
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => { setFilterSearch(searchInput); setPage(0); }}
                >
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
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleSelectAll}
                      />
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
                      className={`border-b last:border-0 ${rowClassForStatus(record.taskStatus, record.attendance)} ${selectedIds.has(record.id) ? 'ring-1 ring-inset ring-blue-300' : ''}`}
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
                        <Select value={record.taskStatus} onValueChange={(val) => {
                          if (val !== null) handleTaskStatusChange(record, val);
                        }}>
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
                              handleUpdateRecord(record.id, 'marks', val === '' ? null : Number(val));
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

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} • {showingFrom}–{showingTo} of {total}
            {selectedIds.size > 0 && <span className="ml-2 text-blue-700">• {selectedIds.size} selected</span>}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && someSelectedOffPage && (
        <p className="text-xs text-blue-700 text-center">
          You have {selectedIds.size} records selected across multiple pages. Click "Bulk Update" to apply changes to all of them at once.
        </p>
      )}

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0
                ? `Update ${selectedIds.size} selected records (across all pages)`
                : 'Update all records in this session'}
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
