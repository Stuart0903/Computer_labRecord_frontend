interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  classSection?: string;
  date?: string;
}

export function PrintHeader({ title, subtitle, classSection, date }: PrintHeaderProps) {
  return (
    <div className="print-header" style={{ display: 'none' }}>
      <h1>{title}</h1>
      <p>
        {classSection && `${classSection} • `}
        {date && `${date} • `}
        Computer Lab Record System
      </p>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}