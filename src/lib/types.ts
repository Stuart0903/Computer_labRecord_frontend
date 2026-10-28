// Teacher
export interface Teacher {
  id: string;
  username: string;
  name: string;
}

// Student
export interface Student {
  id: string;
  studentId: string;
  name: string;
  class: number;
  section: string;
  rollNo: number;
  notes: string | null;
  parentPin: string | null;
  createdAt: string;
  updatedAt: string;
}

// Lab Session
export interface LabSession {
  id: string;
  date: string;
  class: number;
  section: string;
  topic: string;
  activity: string;
  learned: string | null;
  materialsRequired: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  teacher?: Teacher;
  _count?: { labRecords: number };
  labRecords?: LabRecord[];
}

// Lab Record
export interface LabRecord {
  id: string;
  sessionId: string;
  studentId: string;
  rollNo: number;
  taskStatus: string;
  materialsBrought: Record<string, boolean> | null;
  remarks: string | null;
  verified: string;
  attendance: string;
  marks: number | null;
  maxMarks: number | null;
  createdAt: string;
  updatedAt: string;
  student?: Pick<Student, 'studentId' | 'name' | 'class' | 'section' | 'rollNo'>;
  session?: Pick<LabSession, 'id' | 'date' | 'topic' | 'activity' | 'learned' | 'materialsRequired' | 'class' | 'section'>;
}

// Dashboard Stats
export interface DashboardStats {
  totalStudents: number;
  totalSessions: number;
  totalRecords: number;
  completed: number;
  partial: number;
  notCompleted: number;
  notDone: number;
  forgotMaterial: number;
  verified: number;
  pending: number;
  present: number;
  absent: number;
  bunk: number;
  forgotBook: number;
  completionRate: number;
  attendanceRate: number;
}

// Recent Session
export interface RecentSession {
  id: string;
  date: string;
  class: number;
  section: string;
  topic: string;
  activity: string;
  learned: string | null;
  materialsRequired: string | null;
  teacher: Pick<Teacher, 'id' | 'name'>;
  studentCount: number;
  completed: number;
  present: number;
  forgotMaterial: number;
  completionRate: number;
  attendanceRate: number;
}

// Session with per-session stats — returned by GET /sessions/with-stats
export interface SessionWithStats {
  id: string;
  date: string;
  class: number;
  section: string;
  topic: string;
  activity: string;
  learned: string | null;
  materialsRequired: string | null;
  teacher: { id: string; name: string; username: string };
  studentCount: number;
  presentCount: number;
  verifiedCount: number;
  completedCount: number;
}

export interface SessionsWithStatsResult {
  sessions: SessionWithStats[];
  total: number;
}

// Paginated records response — returned by GET /records
export interface PaginatedRecordsResult {
  records: LabRecord[];
  total: number;
}

// Parent Lookup Result
export interface ParentLookupResult {
  student: Pick<Student, 'studentId' | 'name' | 'class' | 'section' | 'rollNo'>;
  records: Array<{
    date: string;
    topic: string;
    activity: string;
    learned: string | null;
    materialsRequired: string | null;
    attendance: string;
    taskStatus: string;
    materialsBrought: Record<string, boolean> | null;
    remarks: string | null;
    verified: string;
    marks: number | null;
    maxMarks: number | null;
  }>;
}

// Upload Result
export interface UploadResult {
  totalStudents: number;
  created: number;
  updated: number;
  processed: number;
  errors: string[];
  parseErrors: string[];
}