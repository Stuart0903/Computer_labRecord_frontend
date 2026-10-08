'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  BarChart3, Printer, Loader2, CheckCircle2, ShieldCheck, BookOpen,
  Users, UserCheck, UserX,
} from 'lucide-react';
import type { DashboardStats, LabSession, ParentLookupResult } from '@/lib/types';
import {
  CLASSES, SECTIONS, TASK_STATUS_COLORS, VERIFIED_COLORS, ATTENDANCE_COLORS,
} from '@/lib/constants';
import { format } from 'date-fns';
import { PrintHeader } from '@/components/layout/print-header';
import { PrintFooter } from '@/components/layout/print-footer';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">View and print lab session reports</p>
      </div>
      <Tabs defaultValue="class">
        <TabsList>
          <TabsTrigger value="class">Class Summary</TabsTrigger>
          <TabsTrigger value="session">Session Report</TabsTrigger>
          <TabsTrigger value="student">Student Report</TabsTrigger>
        </TabsList>
        <TabsContent value="class" className="mt-6"><ClassSummaryReport /></TabsContent>
        <TabsContent value="session" className="mt-6"><SessionReport /></TabsContent>
        <TabsContent value="student" className="mt-6"><StudentReport /></TabsContent>
      </Tabs>
    </div>
  );
}

function ClassSummaryReport() {
  const [selectedClass, setSelectedClass] = useState<string>(String(CLASSES[0]));
  const [selectedSection, setSelectedSection] = useState<string>(SECTIONS[0]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedClass && selectedSection) loadStats();
  }, [selectedClass, selectedSection]);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await api<DashboardStats>(`/stats?class=${selectedClass}&section=${selectedSection}`);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val ?? 'all')}>
                <SelectTrigger className="w-[130px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={selectedSection} onValueChange={(val) => setSelectedSection(val ?? 'all')}>
                <SelectTrigger className="w-[130px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : stats ? (
        <div className="print-area">
          <PrintHeader title={`Class ${selectedClass} - Section ${selectedSection} Summary`} subtitle="Computer Lab Performance Report" />
          <Card>
            <CardHeader>
              <CardTitle>Class {selectedClass} — Section {selectedSection}</CardTitle>
              <CardDescription>Generated on {format(new Date(), 'dd MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatBox label="Students" value={stats.totalStudents} icon={Users} />
                <StatBox label="Sessions" value={stats.totalSessions} icon={BookOpen} />
                <StatBox label="Records" value={stats.totalRecords} icon={BarChart3} />
                <StatBox label="Completion" value={`${stats.completionRate}%`} icon={CheckCircle2} />
                <StatBox label="Attendance" value={`${stats.attendanceRate}%`} icon={UserCheck} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Attendance Breakdown</h3>
                <div className="space-y-2">
                  <ReportBar label="Present" count={stats.present} total={stats.totalRecords} color="emerald" />
                  <ReportBar label="Absent" count={stats.absent} total={stats.totalRecords} color="red" />
                  <ReportBar label="Bunk" count={stats.bunk} total={stats.totalRecords} color="purple" />
                  <ReportBar label="Forgot Book" count={stats.forgotBook} total={stats.totalRecords} color="amber" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Task Status Breakdown</h3>
                <div className="space-y-2">
                  <ReportBar label="Completed" count={stats.completed} total={stats.totalRecords} color="emerald" />
                  <ReportBar label="Partially Completed" count={stats.partial} total={stats.totalRecords} color="amber" />
                  <ReportBar label="Not Completed" count={stats.notCompleted} total={stats.totalRecords} color="red" />
                  <ReportBar label="Not Done" count={stats.notDone} total={stats.totalRecords} color="gray" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Materials</h3>
                  <div className="space-y-2">
                    <ReportBar label="Forgot Material" count={stats.forgotMaterial} total={stats.totalRecords} color="red" />
                    <ReportBar label="Brought All" count={stats.totalRecords - stats.forgotMaterial} total={stats.totalRecords} color="emerald" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Verification</h3>
                  <div className="space-y-2">
                    <ReportBar label="Verified" count={stats.verified} total={stats.totalRecords} color="emerald" />
                    <ReportBar label="Pending" count={stats.pending} total={stats.totalRecords} color="amber" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <PrintFooter />
        </div>
      ) : null}
    </div>
  );
}


function SessionReport() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [sessionData, setSessionData] = useState<LabSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<LabSession[]>('/sessions').then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedSession) loadSession();
  }, [selectedSession]);

  async function loadSession() {
    setLoading(true);
    try {
      const data = await api<LabSession>(`/sessions/${selectedSession}`);
      setSessionData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const records = sessionData?.labRecords || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Select Session</Label>
              <Select value={selectedSession} onValueChange={(val) => setSelectedSession(val ?? 'all')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a session..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.class}-{s.section} - {format(new Date(s.date), 'dd MMM yyyy')} - {s.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sessionData && (
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : sessionData ? (
        <div className="print-area space-y-4">
          <PrintHeader
            title={sessionData.topic}
            classSection={`Class ${sessionData.class}-${sessionData.section}`}
            date={format(new Date(sessionData.date), 'dd MMMM yyyy')}
            subtitle={`Teacher: ${sessionData.teacher?.name || ''}`}
          />
          <Card>
            <CardHeader>
              <CardTitle>Class {sessionData.class}-{sessionData.section} - {sessionData.topic}</CardTitle>
              <CardDescription>
                {format(new Date(sessionData.date), 'dd MMMM yyyy')}
                {sessionData.activity ? ` - ${sessionData.activity}` : ''}
                {sessionData.teacher ? ` - By ${sessionData.teacher.name}` : ''}
              </CardDescription>
            </CardHeader>
            {sessionData.learned && (
              <CardContent>
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                  <span className="font-medium">What We Learned: </span>{sessionData.learned}
                </div>
              </CardContent>
            )}
            {sessionData.materialsRequired && (
              <CardContent>
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <span className="font-medium">Materials Required: </span>{sessionData.materialsRequired}
                </div>
              </CardContent>
            )}
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox label="Students" value={records.length} icon={Users} />
            <StatBox label="Present" value={records.filter((r) => r.attendance === 'Present').length} icon={UserCheck} />
            <StatBox label="Absent" value={records.filter((r) => r.attendance === 'Absent').length} icon={UserX} />
            <StatBox label="Completed" value={records.filter((r) => r.taskStatus === 'Completed').length} icon={CheckCircle2} />
            <StatBox label="Verified" value={records.filter((r) => r.verified === 'Verified').length} icon={ShieldCheck} />
          </div>

          <Card>
            <CardHeader><CardTitle>Student Attendance and Marks</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                      <th className="p-3 font-medium">Roll</th>
                      <th className="p-3 font-medium">ID</th>
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Attendance</th>
                      <th className="p-3 font-medium">Task</th>
                      <th className="p-3 font-medium">Materials</th>
                      <th className="p-3 font-medium">Marks</th>
                      <th className="p-3 font-medium">Verified</th>
                      <th className="p-3 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const materials = record.materialsBrought as Record<string, boolean> | null;
                      const forgotCount = materials ? Object.values(materials).filter((v) => !v).length : 0;
                      return (
                        <tr key={record.id} className="border-b last:border-0">
                          <td className="p-3 font-medium">{record.rollNo}</td>
                          <td className="p-3 font-mono text-xs">{record.studentId}</td>
                          <td className="p-3">{record.student?.name || record.studentId}</td>
                          <td className="p-3">
                            <Badge className={`${ATTENDANCE_COLORS[record.attendance] || 'bg-gray-100 text-gray-800'} text-[10px]`}>{record.attendance}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge className={`${TASK_STATUS_COLORS[record.taskStatus]} text-[10px]`}>{record.taskStatus}</Badge>
                          </td>
                          <td className="p-3">
                            {materials ? (
                              forgotCount > 0 ? (
                                <span className="text-red-600 text-xs font-medium">{forgotCount} missing</span>
                              ) : (
                                <span className="text-emerald-600 text-xs">All</span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {record.marks !== null
                              ? <span className="font-medium">{record.marks}/{record.maxMarks || '-'}</span>
                              : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="p-3">
                            <Badge className={`${VERIFIED_COLORS[record.verified]} text-[10px]`}>{record.verified}</Badge>
                          </td>
                          <td className="p-3 text-slate-500">{record.remarks || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <PrintFooter />
        </div>
      ) : null}
    </div>
  );
}

function StudentReport() {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<ParentLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLookup() {
    if (!studentId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api<ParentLookupResult>('/parent/lookup', {
        method: 'POST',
        body: { studentId: studentId.toUpperCase() },
      });
      setResult(data);
    } catch (err) {
      setError('Student not found');
    } finally {
      setLoading(false);
    }
  }

  const recordsWithMarks = result?.records.filter((r) => r.marks !== null) || [];
  const avgMarks = recordsWithMarks.length > 0
    ? (recordsWithMarks.reduce((sum, r) => sum + (r.marks || 0), 0) / recordsWithMarks.length).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Student ID</Label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 6A01"
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="mt-1"
              />
            </div>
            <Button onClick={handleLookup} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      {result && (
        <div className="print-area space-y-4">
          <PrintHeader
            title={result.student.name}
            classSection={`Class ${result.student.class}-${result.student.section} - Roll ${result.student.rollNo}`}
            subtitle={`Student ID: ${result.student.studentId}`}
          />
          <Card>
            <CardHeader>
              <CardTitle>{result.student.name}</CardTitle>
              <CardDescription>
                Student ID: {result.student.studentId} - Class {result.student.class}-{result.student.section} - Roll {result.student.rollNo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline">Class {result.student.class}</Badge>
                <Badge variant="outline">Section {result.student.section}</Badge>
                <Badge variant="outline">Roll {result.student.rollNo}</Badge>
                {avgMarks && <Badge className="bg-blue-100 text-blue-800">Avg Marks: {avgMarks}</Badge>}
                <Button variant="outline" size="sm" className="ml-auto no-print" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Lab History ({result.records.length} sessions)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {result.records.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No lab records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Topic</th>
                        <th className="p-3 font-medium">Attendance</th>
                        <th className="p-3 font-medium">Task</th>
                        <th className="p-3 font-medium">Materials</th>
                        <th className="p-3 font-medium">Marks</th>
                        <th className="p-3 font-medium">Verified</th>
                        <th className="p-3 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.records.map((record, i) => {
                        const materials = record.materialsBrought as Record<string, boolean> | null;
                        const forgotCount = materials ? Object.values(materials).filter((v) => !v).length : 0;
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3 whitespace-nowrap">{format(new Date(record.date), 'dd MMM yyyy')}</td>
                            <td className="p-3">{record.topic}</td>
                            <td className="p-3">
                              <Badge className={`${ATTENDANCE_COLORS[record.attendance] || 'bg-gray-100 text-gray-800'} text-[10px]`}>{record.attendance}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={`${TASK_STATUS_COLORS[record.taskStatus]} text-[10px]`}>{record.taskStatus}</Badge>
                            </td>
                            <td className="p-3">
                              {materials ? (
                                forgotCount > 0 ? (
                                  <span className="text-red-600 text-xs font-medium">{forgotCount} missing</span>
                                ) : (
                                  <span className="text-emerald-600 text-xs">All</span>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              {record.marks !== null
                                ? <span className="font-medium">{record.marks}/{record.maxMarks || '-'}</span>
                                : <span className="text-slate-400">-</span>}
                            </td>
                            <td className="p-3">
                              <Badge className={`${VERIFIED_COLORS[record.verified]} text-[10px]`}>{record.verified}</Badge>
                            </td>
                            <td className="p-3 text-slate-500">{record.remarks || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <PrintFooter />
        </div>
      )}
    </div>
  );
}


function StatBox({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ReportBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
    purple: 'bg-purple-500',
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor[color] || 'bg-slate-400'} flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(pct, 0)}%` }}
        >
          {pct > 15 && <span className="text-[10px] text-white font-medium">{pct}%</span>}
        </div>
      </div>
      <span className="text-xs text-slate-500 w-16 text-right">{count} ({pct}%)</span>
    </div>
  );
}