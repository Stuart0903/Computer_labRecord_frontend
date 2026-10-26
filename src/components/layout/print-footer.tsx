import { format } from 'date-fns';

/**
 * Print-only footer for the Student Lab Record report.
 * No signature lines — just a slim one-line meta strip.
 */
export function PrintFooter() {
  return (
    <div className="doc-footer" style={{ display: 'none' }}>
      <div className="footer-meta">
        <div className="left">
          <b>Nepal Don Bosco School</b> · Computer Lab Record System · Generated on{' '}
          {format(new Date(), 'dd MMM yyyy, hh:mm a')}
        </div>
        <div className="right">Computer-generated report · Page 1 of 1</div>
      </div>
    </div>
  );
}
