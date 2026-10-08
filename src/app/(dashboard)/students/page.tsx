'use client';

import { useEffect, useState, useRef } from 'react';
import { api, apiFormData, FetchError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  Users,
  PlusCircle,
  Search,
  Upload,
  Download,
  Pencil,
  Trash2,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import type { Student, UploadResult } from '@/lib/types';
import { CLASSES, SECTIONS } from '@/lib/constants';

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Form state
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState<string>('');
  const [formSection, setFormSection] = useState<string>('');
  const [formRollNo, setFormRollNo] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Upload state
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStudents();
  }, [selectedClass, selectedSection, search]);

  async function loadStudents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass !== 'all') params.set('class', selectedClass);
      if (selectedSection !== 'all') params.set('section', selectedSection);
      if (search) params.set('search', search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<Student[]>(`/students${query}`);
      setStudents(data);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setSearch(searchInput);
  }

  // ── ADD ──
  function openAddDialog() {
    setFormName('');
    setFormClass('');
    setFormSection('');
    setFormRollNo(1);
    setFormNotes('');
    setAddDialogOpen(true);
  }

  async function handleAdd() {
    setFormLoading(true);
    try {
      await api<Student>('/students', {
        method: 'POST',
        body: {
          name: formName,
          class: Number(formClass),
          section: formSection,
          rollNo: formRollNo,
          notes: formNotes || undefined,
        },
      });
      toast.success('Student added');
      setAddDialogOpen(false);
      loadStudents();
    } catch (err) {
      if (err instanceof FetchError) toast.error(err.message);
      else toast.error('Failed to add student');
    } finally {
      setFormLoading(false);
    }
  }

  // ── EDIT ──
  function openEditDialog(student: Student) {
    setEditStudent(student);
    setFormName(student.name);
    setFormNotes(student.notes || '');
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!editStudent) return;
    setFormLoading(true);
    try {
      await api<Student>(`/students/${editStudent.id}`, {
        method: 'PATCH',
        body: { name: formName, notes: formNotes || null },
      });
      toast.success('Student updated');
      setEditDialogOpen(false);
      loadStudents();
    } catch (err) {
      toast.error('Failed to update student');
    } finally {
      setFormLoading(false);
    }
  }

  // ── DELETE ──
  function openDeleteDialog(student: Student) {
    setDeleteStudent(student);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteStudent) return;
    setFormLoading(true);
    try {
      await api(`/students/${deleteStudent.id}`, { method: 'DELETE' });
      toast.success('Student deleted');
      setDeleteDialogOpen(false);
      loadStudents();
    } catch (err) {
      toast.error('Failed to delete student');
    } finally {
      setFormLoading(false);
    }
  }

  // ── UPLOAD ──
  function openUploadDialog() {
    setUploadFile(null);
    setUploadMode('append');
    setUploadResult(null);
    setUploadDialogOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('mode', uploadMode);
      const result = await apiFormData<UploadResult>('/students/upload', formData);
      setUploadResult(result);
      toast.success(`Processed ${result.processed} students`);
      loadStudents();
    } catch (err) {
      if (err instanceof FetchError) toast.error(err.message);
      else toast.error('Upload failed');
    } finally {
      setUploadLoading(false);
    }
  }

  // ── RENDER ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">{students.length} students found</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openUploadDialog}>
            <Upload className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={selectedClass} onValueChange={(val) => { setSelectedClass(val ?? 'all'); setSelectedSection('all'); }}>
                <SelectTrigger className="w-[130px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section</Label>
              <Select value={selectedSection} onValueChange={(val) => setSelectedSection(val ?? 'all')}>
                <SelectTrigger className="w-[130px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name or Student ID..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">
              No students found. Add students or upload a CSV.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="p-3 font-medium">Student ID</th>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium">Section</th>
                    <th className="p-3 font-medium">Roll No</th>
                    <th className="p-3 font-medium">Notes</th>
                    <th className="p-3 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {student.studentId}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium text-slate-900">{student.name}</td>
                      <td className="p-3">{student.class}</td>
                      <td className="p-3">{student.section}</td>
                      <td className="p-3">{student.rollNo}</td>
                      <td className="p-3 text-slate-500 max-w-[200px] truncate">
                        {student.notes || '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    onClick={() => router.push(`/students/${student.studentId}`)}
  >
    <Eye className="h-3.5 w-3.5" />
  </Button>
  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(student)}>
    <Pencil className="h-3.5 w-3.5" />
  </Button>
  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => openDeleteDialog(student)}>
    <Trash2 className="h-3.5 w-3.5" />
  </Button>
</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ADD DIALOG ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Student ID will be auto-generated from class, section, and roll number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Student name" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={formClass} onValueChange={(val) => setFormClass(val ?? 'all')}>
                  <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => (
                      <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section *</Label>
                <Select value={formSection} onValueChange={(val) => setFormSection(val ?? 'all')}>
                  <SelectTrigger><SelectValue placeholder="Sec" /></SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Roll No *</Label>
                <Input type="number" min={1} max={99} value={formRollNo} onChange={(e) => setFormRollNo(Number(e.target.value))} />
              </div>
            </div>
            {formClass && formSection && formRollNo && (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                Generated Student ID: <strong>{formClass}{formSection}{String(formRollNo).padStart(2, '0')}</strong>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!formName || !formClass || !formSection || formLoading}>
              {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              {editStudent ? `${editStudent.studentId} — Class ${editStudent.class}-${editStudent.section}, Roll ${editStudent.rollNo}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" />
            </div>
            <p className="text-xs text-slate-500">Class, section, and roll number cannot be changed (they form the Student ID).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={formLoading}>
              {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              {deleteStudent
                ? `Are you sure you want to delete ${deleteStudent.name} (${deleteStudent.studentId})? All their lab records will also be deleted.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
              {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UPLOAD DIALOG ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Students</DialogTitle>
            <DialogDescription>Upload a CSV or XLSX file with student data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mode */}
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={uploadMode} onValueChange={(val: any) => setUploadMode(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">Append (add/update)</SelectItem>
                  <SelectItem value="replace">Replace (delete all + import)</SelectItem>
                </SelectContent>
              </Select>
              {uploadMode === 'replace' && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Replace mode will delete ALL existing students before importing.</span>
                </div>
              )}
            </div>

            {/* File */}
            <div className="space-y-2">
              <Label>File</Label>
              <div
                className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-slate-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-8 w-8 text-slate-400 mb-2" />
                {uploadFile ? (
                  <p className="text-sm font-medium text-slate-700">{uploadFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">Click to select file</p>
                    <p className="text-xs text-slate-400 mt-1">CSV or XLSX</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Required columns info */}
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium mb-1">Required columns:</p>
              <p>Student Name, Class, Section, Roll No</p>
              <p className="mt-1"><span className="font-medium">Optional:</span> Notes</p>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 space-y-1">
                <p className="font-medium">Upload Complete</p>
                <p>Created: {uploadResult.created} | Updated: {uploadResult.updated} | Total: {uploadResult.totalStudents}</p>
                {(uploadResult.parseErrors?.length > 0 || uploadResult.errors?.length > 0) && (
                  <div className="mt-2 text-xs text-red-700 space-y-0.5">
                    <p className="font-medium">Errors:</p>
                    {[...(uploadResult.parseErrors || []), ...(uploadResult.errors || [])].map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Close</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploadLoading}>
              {uploadLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}