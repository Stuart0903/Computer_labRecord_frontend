import { format } from 'date-fns';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  classSection?: string;
  date?: string;
  studentId?: string;
  classNum?: number | string;
  section?: string;
  rollNo?: number | string;
}

/**
 * Print-only letterhead for the Student Lab Record report.
 * Hidden on screen (display:none) and revealed only inside @media print.
 */
export function PrintHeader({
  title,
  subtitle,
  classSection,
  date,
  studentId,
  classNum,
  section,
  rollNo,
}: PrintHeaderProps) {
  const issuedDate = date || format(new Date(), 'dd MMM yyyy');
  const ref = studentId ? `LAB-${new Date().getFullYear()}-${studentId}` : `LAB-${new Date().getFullYear()}`;

  // Build the right-side student summary line
  const classLineParts: string[] = [];
  if (classSection) classLineParts.push(classSection);
  else {
    if (classNum !== undefined) classLineParts.push(`Class ${classNum}${section ? `-${section}` : ''}`);
    if (rollNo !== undefined) classLineParts.push(`Roll ${rollNo}`);
  }
  const classLine = classLineParts.join(' · ');

  return (
    <div className="doc-header" style={{ display: 'none' }}>
      <div className="school">
        <div className="logo-box">DB</div>
        <div className="school-text">
          <h1>Nepal Don Bosco School</h1>
          <p>Computer Lab Department · Academic Year {new Date().getFullYear() - 1}–{String(new Date().getFullYear()).slice(-2)}</p>
        </div>
      </div>
      <div className="meta">
        <div className="ref">Ref: {ref}</div>
        <div>Issued: {issuedDate}</div>
        <div>Page 1 of 1</div>
      </div>

      <div className="doc-title">
        <span className="label">Student Lab Record</span>
        <h2>Computer Lab Session Report</h2>
        <p>
          {subtitle || 'Summary of lab attendance, task completion and performance'}
          {classLine && ` · ${classLine}`}
        </p>
      </div>
    </div>
  );
}
