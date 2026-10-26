'use client';

import { useState } from 'react';
import { api, FetchError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Laptop, Search, Printer } from 'lucide-react';
import type { ParentLookupResult } from '@/lib/types';
import {
  TASK_STATUS_COLORS,
  VERIFIED_COLORS,
  ATTENDANCE_COLORS,
} from '@/lib/constants';
import { format } from 'date-fns';
import { PrintHeader } from '@/components/layout/print-header';
import { PrintFooter } from '@/components/layout/print-footer';

// Print-friendly dot indicators (used inside the printed table)
const ATTENDANCE_DOT: Record<string, string> = {
  Present: 'present',
  Absent: 'absent',
  Bunk: 'bunk',
  'Forgot Book': 'forgot',
};
const TASK_DOT: Record<string, string> = {
  Completed: 'done',
  'Partially Completed': 'partial',
  'Not Completed': 'notdone',
  'Not Done': 'notstarted',
};
const VERIFIED_DOT: Record<string, string> = {
  Verified: 'verified',
  Pending: 'pending',
};

export default function LookupPage() {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<ParentLookupResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const data = await api<ParentLookupResult>('/parent/lookup', {
        method: 'POST',
        body: { studentId: studentId.toUpperCase() },
      });
      setResult(data);
    } catch (err) {
      if (err instanceof FetchError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  const recordsWithMarks = result?.records.filter((r) => r.marks !== null) || [];
  const avgMarks = recordsWithMarks.length > 0
    ? (recordsWithMarks.reduce((sum, r) => sum + (r.marks || 0), 0) / recordsWithMarks.length).toFixed(1)
    : null;
  const presentCount = result?.records.filter((r) => r.attendance === 'Present').length || 0;
  const totalRecords = result?.records.length || 0;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 no-print">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
            <Laptop className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Computer Lab Records</h1>
          <p className="text-slate-500 mt-1">Look up your child&apos;s lab history</p>
        </div>

        <Card className="mb-6 no-print">
          <CardContent className="pt-6">
            <form onSubmit={handleLookup} className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 6A01"
                  required
                  disabled={loading}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Searching...' : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Look Up
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-6 no-print">{error}</div>
        )}

        {result && (
          <div className="print-area space-y-4">
            {/* Hidden on screen, only visible when printing */}
            <PrintHeader
              title={result.student.name}
              classSection={`Class ${result.student.class}-${result.student.section} · Roll ${result.student.rollNo}`}
              subtitle={`Student ID: ${result.student.studentId}`}
              studentId={result.student.studentId}
              classNum={result.student.class}
              section={result.student.section}
              rollNo={result.student.rollNo}
            />

            {/* ===== Student Profile (screen view) ===== */}
            <Card className="no-print">
              <CardHeader>
                <CardTitle>Student Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500">Student ID</p>
                    <p className="text-sm font-medium">{result.student.studentId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="text-sm font-medium">{result.student.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Class</p>
                    <p className="text-sm font-medium">{result.student.class}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Section</p>
                    <p className="text-sm font-medium">{result.student.section}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Roll No</p>
                    <p className="text-sm font-medium">{result.student.rollNo}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {totalRecords} Sessions
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 text-sm py-1 px-3">
                    Attendance: {attendanceRate}%
                  </Badge>
                  {avgMarks && (
                    <Badge className="bg-blue-100 text-blue-800 text-sm py-1 px-3">
                      Avg Marks: {avgMarks}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ===== Lab History (shown on screen AND printed) ===== */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lab History</CardTitle>
                <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </CardHeader>
              <CardContent>
                {result.records.length === 0 ? (
                  <p className="text-sm text-slate-500">No lab records found.</p>
                ) : (
                  <>
                    {/* ===== Print-only student info + summary ===== */}
                    <div className="print-only-block" style={{ display: 'none' }}>
                      <div className="info-section">
                        <div className="section-head">Student Information</div>
                        <div className="info-grid">
                          <div className="field">
                            <div className="k">Student ID</div>
                            <div className="v">{result.student.studentId}</div>
                          </div>
                          <div className="field">
                            <div className="k">Full Name</div>
                            <div className="v">{result.student.name}</div>
                          </div>
                          <div className="field">
                            <div className="k">Class</div>
                            <div className="v">{result.student.class}</div>
                          </div>
                          <div className="field">
                            <div className="k">Section</div>
                            <div className="v">{result.student.section}</div>
                          </div>
                          <div className="field">
                            <div className="k">Roll No</div>
                            <div className="v">{result.student.rollNo}</div>
                          </div>
                          <div className="field">
                            <div className="k">Report Date</div>
                            <div className="v">{format(new Date(), 'dd MMM yyyy')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="summary-strip">
                        <div className="summary-card">
                          <div className="num">{totalRecords}</div>
                          <div className="lbl">Total Sessions</div>
                        </div>
                        <div className="summary-card">
                          <div className="num att">{attendanceRate}%</div>
                          <div className="lbl">Attendance Rate</div>
                        </div>
                        <div className="summary-card">
                          <div className="num avg">{avgMarks ?? '—'}</div>
                          <div className="lbl">Average Marks</div>
                        </div>
                      </div>
                    </div>

                    {/* ===== Records table (shared by screen + print) ===== */}
                    <div className="table-wrap">
                      <div className="table-section-head print-only-block" style={{ display: 'none' }}>
                        Lab Session History
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm records-table">
                          <thead>
                            <tr className="border-b text-left text-xs text-slate-500">
                              <th className="pb-3 pr-4 font-medium col-idx">#</th>
                              <th className="pb-3 pr-4 font-medium col-date">Date</th>
                              <th className="pb-3 pr-4 font-medium col-topic">Topic</th>
                              <th className="pb-3 pr-4 font-medium col-attend">Attendance</th>
                              <th className="pb-3 pr-4 font-medium col-task">Task Status</th>
                              <th className="pb-3 pr-4 font-medium col-mat">Materials</th>
                              <th className="pb-3 pr-4 font-medium col-marks">Marks</th>
                              <th className="pb-3 pr-4 font-medium col-verify">Verified</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.records.map((record, i) => {
                              const materials = record.materialsBrought as Record<string, boolean> | null;
                              const forgotCount = materials ? Object.values(materials).filter((v) => !v).length : 0;
                              return (
                                <tr key={i}>
                                  <td className="py-3 pr-4 idx">{i + 1}</td>
                                  <td className="py-3 pr-4 nowrap">
                                    {format(new Date(record.date), 'dd MMM yyyy')}
                                  </td>
                                  <td className="py-3 pr-4 topic">
                                    <div className="topic-main">{record.topic}</div>
                                    {record.learned && (
                                      <div className="topic-sub">{record.learned}</div>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4">
                                    {/* Print dot (hidden on screen) */}
                                    <span
                                      className={`dot ${ATTENDANCE_DOT[record.attendance] || ''} print-only-inline`}
                                      style={{ display: 'none' }}
                                    >
                                      {record.attendance}
                                    </span>
                                    {/* Screen badge */}
                                    <Badge
                                      className={`${ATTENDANCE_COLORS[record.attendance] || 'bg-gray-100 text-gray-800'} text-[10px] no-print`}
                                    >
                                      {record.attendance}
                                    </Badge>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span
                                      className={`dot ${TASK_DOT[record.taskStatus] || ''} print-only-inline`}
                                      style={{ display: 'none' }}
                                    >
                                      {record.taskStatus}
                                    </span>
                                    <Badge className={`${TASK_STATUS_COLORS[record.taskStatus]} text-[10px] no-print`}>
                                      {record.taskStatus}
                                    </Badge>
                                  </td>
                                  <td className="py-3 pr-4 mat">
                                    {materials ? (
                                      forgotCount > 0 ? (
                                        <span className="mat-miss">{forgotCount} missing</span>
                                      ) : (
                                        <span className="mat-ok">All brought</span>
                                      )
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 marks">
                                    {record.marks !== null ? (
                                      <span className="font-medium">{record.marks}/{record.maxMarks || '-'}</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span
                                      className={`dot ${VERIFIED_DOT[record.verified] || ''} print-only-inline`}
                                      style={{ display: 'none' }}
                                    >
                                      {record.verified}
                                    </span>
                                    <Badge className={`${VERIFIED_COLORS[record.verified]} text-[10px] no-print`}>
                                      {record.verified}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <PrintFooter />
          </div>
        )}
      </div>
    </div>
  );
}
