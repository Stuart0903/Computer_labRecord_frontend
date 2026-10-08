'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Clock,
  TrendingUp,
  UserCheck,
  UserX,
  Coffee,
  BookX,
  Package,
} from 'lucide-react';
import type { DashboardStats, RecentSession } from '@/lib/types';
import { CLASSES, SECTIONS } from '@/lib/constants';
import { format } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(false);

  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      loadRecentSessions();
    }
    loadStats();
  }, [selectedClass, selectedSection]);

  async function loadStats() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass !== 'all') params.set('class', selectedClass);
      if (selectedSection !== 'all') params.set('section', selectedSection);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<DashboardStats>(`/stats${query}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentSessions() {
    try {
      const data = await api<RecentSession[]>('/stats/recent-sessions?limit=10');
      setRecentSessions(data);
    } catch (err) {
      console.error('Failed to load recent sessions', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of lab sessions and records</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedClass}
            onValueChange={(val) => {
              setSelectedClass(val ?? 'all');
              setSelectedSection('all');
            }}
          >
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {CLASSES.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={selectedSection}
            onValueChange={(val) => setSelectedSection(val ?? 'all')}
          >
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {SECTIONS.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Total Students" value={stats?.totalStudents ?? 0} icon={Users} color="blue" loading={loading} />
        <KPICard title="Total Sessions" value={stats?.totalSessions ?? 0} icon={BookOpen} color="purple" loading={loading} />
        <KPICard title="Total Records" value={stats?.totalRecords ?? 0} icon={ClipboardList} color="indigo" loading={loading} />
        <KPICard title="Completion Rate" value={`${stats?.completionRate ?? 0}%`} icon={TrendingUp} color="emerald" loading={loading} />
        <KPICard title="Attendance Rate" value={`${stats?.attendanceRate ?? 0}%`} icon={UserCheck} color="teal" loading={loading} />
        <KPICard title="Forgot Material" value={stats?.forgotMaterial ?? 0} icon={Package} color="red" loading={loading} />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Task Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Task Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Completed" count={stats?.completed ?? 0} total={stats?.totalRecords ?? 0} color="emerald" icon={CheckCircle2} />
            <StatusRow label="Partially Completed" count={stats?.partial ?? 0} total={stats?.totalRecords ?? 0} color="amber" icon={Clock} />
            <StatusRow label="Not Completed" count={stats?.notCompleted ?? 0} total={stats?.totalRecords ?? 0} color="red" icon={AlertCircle} />
            <StatusRow label="Not Done" count={stats?.notDone ?? 0} total={stats?.totalRecords ?? 0} color="gray" icon={XCircle} />
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Present" count={stats?.present ?? 0} total={stats?.totalRecords ?? 0} color="emerald" icon={UserCheck} />
            <StatusRow label="Absent" count={stats?.absent ?? 0} total={stats?.totalRecords ?? 0} color="red" icon={UserX} />
            <StatusRow label="Bunk" count={stats?.bunk ?? 0} total={stats?.totalRecords ?? 0} color="purple" icon={Coffee} />
            <StatusRow label="Forgot Book" count={stats?.forgotBook ?? 0} total={stats?.totalRecords ?? 0} color="amber" icon={BookX} />
          </CardContent>
        </Card>

        {/* Verification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Verified" count={stats?.verified ?? 0} total={stats?.totalRecords ?? 0} color="emerald" icon={ShieldCheck} />
            <StatusRow label="Pending" count={stats?.pending ?? 0} total={stats?.totalRecords ?? 0} color="amber" icon={Clock} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Sessions</CardTitle>
          <Link href="/new-session">
            <Button size="sm"><BookOpen className="mr-2 h-4 w-4" /> New Session</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Topic</th>
                    <th className="pb-3 pr-4 font-medium">Teacher</th>
                    <th className="pb-3 pr-4 font-medium">Students</th>
                    <th className="pb-3 pr-4 font-medium">Present</th>
                    <th className="pb-3 pr-4 font-medium">Attendance</th>
                    <th className="pb-3 pr-4 font-medium">Completed</th>
                    <th className="pb-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((session) => (
                    <tr key={session.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 pr-4 whitespace-nowrap">{format(new Date(session.date), 'dd MMM yyyy')}</td>
                      <td className="py-3 pr-4">{session.class}-{session.section}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">{session.topic}</td>
                      <td className="py-3 pr-4">{session.teacher.name}</td>
                      <td className="py-3 pr-4">{session.studentCount}</td>
                      <td className="py-3 pr-4">{session.present}</td>
                      <td className="py-3 pr-4">
                        <Badge className={session.attendanceRate >= 80 ? 'bg-emerald-100 text-emerald-800' : session.attendanceRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                          {session.attendanceRate}%
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{session.completed}</td>
                      <td className="py-3">
                        <Badge className={session.completionRate >= 80 ? 'bg-emerald-100 text-emerald-800' : session.completionRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                          {session.completionRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ──

interface KPICardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}

function KPICard({ title, value, icon: Icon, color, loading }: KPICardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    teal: 'bg-teal-50 text-teal-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color] || 'bg-slate-50 text-slate-600'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusRowProps {
  label: string;
  count: number;
  total: number;
  color: string;
  icon: React.ElementType;
}

function StatusRow({ label, count, total, color, icon: Icon }: StatusRowProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
    purple: 'bg-purple-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-700">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="text-slate-500">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor[color] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}