import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef {
  label: string;
  align?: 'left' | 'right' | 'center';
  /** Tailwind responsive visibility class, e.g. "hidden sm:table-cell" */
  responsive?: string;
  className?: string;
}

// ─── TableHead ────────────────────────────────────────────────────────────────

/**
 * Renders a consistent `<thead>` row for all data tables.
 *
 * Usage:
 *   <TableHead columns={[
 *     { label: 'Company' },
 *     { label: 'Owner', responsive: 'hidden sm:table-cell' },
 *     { label: 'Revenue', align: 'right' },
 *   ]} />
 */
export function TableHead({ columns }: { columns: ColumnDef[] }) {
  return (
    <thead>
      <tr className="border-b border-[#262626]">
        {columns.map((col) => (
          <th
            key={col.label}
            scope="col"
            className={cn(
              'text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3',
              col.align === 'right'  ? 'text-right'  :
              col.align === 'center' ? 'text-center' : 'text-left',
              col.responsive,
              col.className,
            )}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

/**
 * Standard table body row with hover state and optional click handler.
 */
export function TableRow({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-[#1A1A1A] last:border-0',
        onClick ? 'cursor-pointer hover:bg-[#1A1A1A] transition-colors' : '',
        className,
      )}
    >
      {children}
    </tr>
  );
}

// ─── TableCell ────────────────────────────────────────────────────────────────

export function TableCell({
  children,
  align = 'left',
  responsive,
  className,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  responsive?: string;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-[#E8E6E3]',
        align === 'right'  ? 'text-right'  :
        align === 'center' ? 'text-center' : 'text-left',
        responsive,
        className,
      )}
    >
      {children}
    </td>
  );
}

// ─── SortableHeader ───────────────────────────────────────────────────────────

export function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      scope="col"
      className={cn(
        'text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 text-left',
        'cursor-pointer select-none hover:text-[#E8E6E3] transition-colors',
        active && 'text-[#C9A227]',
        className,
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {active && (
        <span className="ml-1 text-[#C9A227]">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );
}
