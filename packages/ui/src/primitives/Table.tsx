import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  className,
}: TableProps<T>) {
  return (
    <div className={twMerge('w-full overflow-x-auto bg-white rounded-xl border border-gray-200/80 shadow-xs', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100 bg-[#F3F6FC]/50 text-xs font-semibold text-[#656C79] uppercase tracking-wider">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'py-3.5 px-4 font-medium',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm text-[#082051]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-[#656C79]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={clsx(
                  'h-14 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-[#F3F6FC]/60'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'py-3.5 px-4',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row, index) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
