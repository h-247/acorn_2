import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#082051]">{label}</label>}
        <select
          ref={ref}
          className={twMerge(
            clsx(
              'w-full bg-white text-[#082051] text-sm rounded-lg border border-gray-200 px-3 py-2 transition-colors focus:outline-none focus:border-[#0967F7] focus:ring-1 focus:ring-[#0967F7]',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className
            )
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
