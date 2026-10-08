import { format } from 'date-fns';

export function PrintFooter() {
  return (
    <div className="print-footer" style={{ display: 'none' }}>
      Generated on {format(new Date(), 'dd MMMM yyyy • hh:mm a')} • Computer Lab Record System
    </div>
  );
}