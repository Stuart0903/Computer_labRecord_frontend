'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from 'react-hot-toast';
import {
  PlusCircle,
  Loader2,
  Pencil,
  Trash2,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import type { SessionsWithStatsResult, SessionWithStats } from '@/lib/types';
import { CLASSES, SECTIONS } from '@/lib/constants';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(0); // 0-indexed

  // Edit dialog
  const [editing, setEditing] = useState<SessionWithStats | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    topic: '',
    activity: '',
    learned: '',
    materialsRequired: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete dialog
  const [deleting, setDeleting] = useState<SessionWithStats | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [filterClass, filterSection, filterSearch, page]);

  async function loadSessions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClass !== 'all') params.set('class', filterClass);
      if (filterSection !== 'all') params.set('section', filterSection);
      if (filterSearch) params.set('search', filterSearch);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const data = await api<SessionsWithStatsResult>(`/sessions/with-stats?${params.toString()}`);
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setFilterClass('all');
    setFilterSection('all');
    setFilterSearch('');
    setSearchInput('');
    setPage(0);
  }

  const hasFilters = filterClass !== 'all' || filterSection !== 'all' || filterSearch !== '';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  // ─── Edit ───────────────────────────────────────────────────

  function openEditDialog(session: SessionWithStats) {
    setEditing(session);
    setEditForm({
      date: format(new Date(session.date), 'yyyy-MM-dd'),
      topic: session.topic,
      activity: session.activity || '',
      learned: session.learned || '',
      materialsRequired: session.materialsRequired || '',
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editForm.topic.trim() || !editForm.date) {
      toast.error('Topic and Date are required');
      return;
    }
    setEditLoading(true);
    try {
      await api(`/sessions/${editing.id}`, {
        method: 'PATCH',
        body: {
          date: editForm.date,
          topic: editForm.topic.trim(),
          activity: editForm.activity.trim() || '',
          learned: editForm.learned.trim() || null,
          materialsRequired: editForm.materialsRequired.trim() || null,
        },
      });
      toast.success('Session updated');
      setEditing(null);
      loadSessions();
    } catch (err) {
      toast.error('Failed to update session');
    } finally {
      setEditLoading(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────

  function openDeleteDialog(session: SessionWithStats) {
    setDeleting(session);
    setDeleteConfirm('');
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      await api(`/sessions/${deleting.id}`, { method: 'DELETE' });
      toast.success('Session deleted');
      setDeleting(null);
      setDeleteConfirm('');
      // If we deleted the last item on the current page, go back one page
      if (sessions.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        loadSessions();
      }
    } catch (err) {
      toast.error('Failed to delete session');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
          <p className="text-slate-500 mt-1">
            {total} total • showing {showingFrom}–{showingTo}
          </p>
        </div>
        <Link href="/new-session">
          <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Class</Label>
              <Select
                value={filterClass}
                onValueChange={(val) => {
                  setFilterClass(val ?? 'all');
                  setFilterSection('all');
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
            <div className="col-span-2">
              <Label className="text-xs">Search topic / activity / learned</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilterSearch(searchInput);
                      setPage(0);
                    }
                  }}
                  placeholder="e.g. HTML, Python..."
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setFilterSearch(searchInput);
                    setPage(0);
                  }}
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">
              {hasFilters ? 'No sessions match your filters.' : 'No sessions yet. Click "New Session" to create one.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium">Topic</th>
                    <th className="p-3 font-medium">Teacher</th>
                    <th className="p-3 font-medium w-20 text-center">Students</th>
                    <th className="p-3 font-medium w-20 text-center">Present</th>
                    <th className="p-3 font-medium w-20 text-center">Completed</th>
                    <th className="p-3 font-medium w-20 text-center">Verified</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const attendanceRate = session.studentCount > 0
                      ? Math.round((session.presentCount / session.studentCount) * 100)
                      : 0;
                    const verifiedRate = session.studentCount > 0
                      ? Math.round((session.verifiedCount / session.studentCount) * 100)
                      : 0;
                    return (
                      <tr key={session.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3 whitespace-nowrap text-slate-600">
                          {format(new Date(session.date), 'dd MMM yyyy')}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {session.class}-{session.section}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-900 max-w-[260px] truncate">
                            {session.topic}
                          </div>
                          {session.activity && (
                            <div className="text-xs text-slate-500 mt-0.5 max-w-[260px] truncate">
                              {session.activity}
                            </div>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-600">
                          {session.teacher?.name || '—'}
                        </td>
                        <td className="p-3 text-center text-slate-700">{session.studentCount}</td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              attendanceRate >= 80
                                ? 'bg-emerald-100 text-emerald-800 text-xs'
                                : attendanceRate >= 50
                                ? 'bg-amber-100 text-amber-800 text-xs'
                                : 'bg-red-100 text-red-800 text-xs'
                            }
                          >
                            {session.presentCount} ({attendanceRate}%)
                          </Badge>
                        </td>
                        <td className="p-3 text-center text-slate-700">
                          {session.completedCount}/{session.studentCount}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              verifiedRate === 100
                                ? 'bg-emerald-100 text-emerald-800 text-xs'
                                : verifiedRate > 0
                                ? 'bg-amber-100 text-amber-800 text-xs'
                                : 'bg-slate-100 text-slate-600 text-xs'
                            }
                          >
                            {session.verifiedCount}/{session.studentCount}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(session)}
                              title="Edit session"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openDeleteDialog(session)}
                              title="Delete session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
            Page {page + 1} of {totalPages}
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

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              {editing && `${editing.class}-${editing.section} • ${format(new Date(editing.date), 'dd MMM yyyy')} • ${editing.studentCount} students`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>Topic *</Label>
              <Input
                value={editForm.topic}
                onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                placeholder="e.g. Introduction to HTML"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Activity</Label>
              <Input
                value={editForm.activity}
                onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                placeholder="e.g. Creating a webpage"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>What We Learned</Label>
              <Textarea
                value={editForm.learned}
                onChange={(e) => setEditForm({ ...editForm, learned: e.target.value })}
                placeholder="Summary of what students learned (visible to parents)"
                rows={3}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Materials Required</Label>
              <Input
                value={editForm.materialsRequired}
                onChange={(e) => setEditForm({ ...editForm, materialsRequired: e.target.value })}
                placeholder="e.g. Lab copy, Lab paper, Textbook (comma-separated)"
              />
              <p className="text-xs text-slate-500">
                Note: editing materials does NOT retroactively update the per-student &quot;brought&quot; flags on existing records.
              </p>
            </div>
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Class and section cannot be changed. To move this session to a different class/section, delete this session and create a new one.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete Session</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-slate-50 border p-3 text-sm">
                <div className="font-semibold text-slate-900">{deleting.topic}</div>
                <div className="text-slate-600 mt-1">
                  Class {deleting.class}-{deleting.section} • {format(new Date(deleting.date), 'dd MMM yyyy')} • {deleting.teacher?.name}
                </div>
              </div>
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                This will permanently delete:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><strong>1 session</strong> (topic, activity, learned notes)</li>
                  <li><strong>{deleting.studentCount} student records</strong> (attendance, marks, materials, remarks, verified status)</li>
                </ul>
                <p className="mt-2 text-xs">
                  If you only need to fix a typo, consider <strong>Edit</strong> instead.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm
                </Label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteLoading || deleteConfirm !== 'DELETE'}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
