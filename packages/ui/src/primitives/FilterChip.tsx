import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FilterChipProps {
  label: string;
  value?: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  value,
  active = false,
  onClick,
  onRemove,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer',
          active
            ? 'bg-blue-50 text-[#0967F7] border-blue-200'
            : 'bg-white text-[#656C79] border-gray-200 hover:border-gray-300 hover:text-[#082051]',
          className
        )
      )}
    >
      <span>{label}</span>
      {value && <span className="font-semibold text-[#082051]">({value})</span>}
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-red-500"
        >
          ×
        </span>
      )}
    </button>
  );
};
