'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Printer,
  Loader2,
  UserCheck,
  UserX,
  CheckCircle2,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import type { Student, LabRecord } from '@/lib/types';
import {
  TASK_STATUS_COLORS,
  VERIFIED_COLORS,
  ATTENDANCE_COLORS,
} from '@/lib/constants';
import { format } from 'date-fns';
import { PrintHeader } from '@/components/layout/print-header';
import { PrintFooter } from '@/components/layout/print-footer';

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);
    try {
      const studentData = await api<Student[]>(`/students?search=${studentId}`);
      const found = studentData.find((s) => s.studentId === studentId);
      setStudent(found || null);

      const recordsData = await api<LabRecord[]>(`/records?studentId=${studentId}&limit=200`);
      setRecords(recordsData);
    } catch (err) {
      console.error('Failed to load student', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
        </Button>
        <p className="text-slate-500">Student not found.</p>
      </div>
    );
  }

  const totalSessions = records.length;
  const presentCount = records.filter((r) => r.attendance === 'Present').length;
  const absentCount = records.filter((r) => r.attendance === 'Absent').length;
  const bunkCount = records.filter((r) => r.attendance === 'Bunk').length;
  const forgotBookCount = records.filter((r) => r.attendance === 'Forgot Book').length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  const completedCount = records.filter((r) => r.taskStatus === 'Completed').length;
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  const forgotMaterialCount = records.filter((r) => {
    if (!r.materialsBrought) return false;
    return Object.values(r.materialsBrought).some((v) => v === false);
  }).length;
  const verifiedCount = records.filter((r) => r.verified === 'Verified').length;

  const recordsWithMarks = records.filter((r) => r.marks !== null);
  const avgMarks = recordsWithMarks.length > 0
    ? (recordsWithMarks.reduce((sum, r) => sum + (r.marks || 0), 0) / recordsWithMarks.length).toFixed(1)
    : null;
  const highestMarks = recordsWithMarks.length > 0
    ? Math.max(...recordsWithMarks.map((r) => r.marks || 0))
    : null;

  return (
    <div className="space-y-6 print-area">
      <PrintHeader
        title={student.name}
        classSection={`Class ${student.class}-${student.section} - Roll ${student.rollNo}`}
        subtitle={`Student ID: ${student.studentId}`}
      />

      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={() => router.push('/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print Profile
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {student.name}
            <Badge variant="outline" className="font-mono text-sm">{student.studentId}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-slate-500">Class</p>
              <p className="text-lg font-semibold">{student.class}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Section</p>
              <p className="text-lg font-semibold">{student.section}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Roll No</p>
              <p className="text-lg font-semibold">{student.rollNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Student ID</p>
              <p className="text-lg font-semibold font-mono">{student.studentId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Notes</p>
              <p className="text-sm text-slate-700">{student.notes || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Sessions</p>
              <p className="text-lg font-semibold">{totalSessions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Attendance Rate" value={`${attendanceRate}%`} icon={UserCheck} color={attendanceRate >= 75 ? 'emerald' : attendanceRate >= 50 ? 'amber' : 'red'} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={CheckCircle2} color={completionRate >= 75 ? 'emerald' : completionRate >= 50 ? 'amber' : 'red'} />
        <StatCard label="Present" value={presentCount} icon={UserCheck} color="emerald" />
        <StatCard label="Absent" value={absentCount} icon={UserX} color="red" />
        <StatCard label="Forgot Material" value={forgotMaterialCount} icon={BookOpen} color="amber" />
        <StatCard label="Avg Marks" value={avgMarks || '-'} icon={TrendingUp} color="blue" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Present" count={presentCount} total={totalSessions} color="emerald" />
            <MiniStat label="Absent" count={absentCount} total={totalSessions} color="red" />
            <MiniStat label="Bunk" count={bunkCount} total={totalSessions} color="purple" />
            <MiniStat label="Forgot Book" count={forgotBookCount} total={totalSessions} color="amber" />
          </div>
        </CardContent>
      </Card>

      {recordsWithMarks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Marks Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Graded Sessions</p>
                <p className="text-lg font-semibold">{recordsWithMarks.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Average Marks</p>
                <p className="text-lg font-semibold">{avgMarks}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Highest Marks</p>
                <p className="text-lg font-semibold">{highestMarks}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Verified</p>
                <p className="text-lg font-semibold">{verifiedCount} / {totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Full Lab History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
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
                  {records.map((record) => {
                    const materials = record.materialsBrought as Record<string, boolean> | null;
                    const forgotCount = materials ? Object.values(materials).filter((v) => !v).length : 0;
                    return (
                      <tr key={record.id} className="border-b last:border-0">
                        <td className="p-3 whitespace-nowrap">
                          {record.session ? format(new Date(record.session.date), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="p-3">{record.session?.topic || '-'}</td>
                        <td className="p-3">
                          <Badge className={`${ATTENDANCE_COLORS[record.attendance] || 'bg-gray-100 text-gray-800'} text-[10px]`}>
                            {record.attendance}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={`${TASK_STATUS_COLORS[record.taskStatus]} text-[10px]`}>
                            {record.taskStatus}
                          </Badge>
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
                          {record.marks !== null ? (
                            <span className="font-medium">{record.marks}/{record.maxMarks || '-'}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge className={`${VERIFIED_COLORS[record.verified]} text-[10px]`}>
                            {record.verified}
                          </Badge>
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
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgMap[color] || 'bg-slate-50 text-slate-600'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        </div>
      </CardContent>\n</Card>
  );
}

function MiniStat({ label, count, total, color }: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  };
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barMap[color] || 'bg-slate-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}