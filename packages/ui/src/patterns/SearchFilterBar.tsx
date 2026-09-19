import React from 'react';
import { Input } from '../primitives/Input';;

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  selectedValue?: string;
  onChange: (value: string) => void;
}

export interface SearchFilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterGroup[];
  sortOptions?: FilterOption[];
  selectedSort?: string;
  onSortChange?: (value: string) => void;
  rightAction?: React.ReactNode;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filters = [],
  sortOptions,
  selectedSort,
  onSortChange,
  rightAction,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 py-3">
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        <div className="w-full md:w-72">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-[#F3F6FC]/60 border-gray-200"
          />
        </div>
        {filters.map((group) => (
          <select
            key={group.id}
            value={group.selectedValue || ''}
            onChange={(e) => group.onChange(e.target.value)}
            className="text-xs bg-white text-[#082051] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0967F7] cursor-pointer"
          >
            <option value="">{group.label}</option>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sortOptions && onSortChange && (
          <select
            value={selectedSort || ''}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-xs bg-white text-[#656C79] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0967F7] cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        )}
        {rightAction}
      </div>
    </div>
  );
};
