import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type SemanticStatus =
  | 'draft'
  | 'under-review'
  | 'approved'
  | 'published'
  | 'active'
  | 'archived'
  | 'correct'
  | 'incorrect'
  | 'high'
  | 'medium'
  | 'low'
  | 'no-data';

export interface StatusBadgeProps {
  status: SemanticStatus | string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const normalized = status.toLowerCase().replace(/_/g, '-') as SemanticStatus;

  const config: Record<
    SemanticStatus,
    { label: string; dotClass: string; bgClass: string; textClass: string }
  > = {
    draft: {
      label: 'Draft',
      dotClass: 'bg-amber-500',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
    },
    'under-review': {
      label: 'Under review',
      dotClass: 'bg-amber-500',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
    },
    approved: {
      label: 'Approved',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
    },
    published: {
      label: 'Published',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
    },
    active: {
      label: 'Active',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
    },
    archived: {
      label: 'Archived',
      dotClass: 'bg-gray-400',
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-600',
    },
    correct: {
      label: 'Correct',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
    },
    incorrect: {
      label: 'Incorrect',
      dotClass: 'bg-red-500',
      bgClass: 'bg-red-50',
      textClass: 'text-red-700',
    },
    high: {
      label: 'High',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
    },
    medium: {
      label: 'Medium',
      dotClass: 'bg-amber-500',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
    },
    low: {
      label: 'Low',
      dotClass: 'bg-orange-500',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
    },
    'no-data': {
      label: 'No data',
      dotClass: 'bg-slate-400',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-600',
    },
  };

  const item = config[normalized] || {
    label: label || status,
    dotClass: 'bg-gray-400',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          item.bgClass,
          item.textClass,
          className
        )
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', item.dotClass)} />
      {label || item.label}
    </span>
  );
};
