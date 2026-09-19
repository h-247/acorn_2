import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'blue' | 'emerald' | 'amber' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  color = 'blue',
  size = 'md',
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colorClasses = {
    blue: 'bg-[#0967F7]',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-600',
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={twMerge('w-full flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-medium text-[#082051]">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={clsx('w-full bg-[#F3F6FC] rounded-full overflow-hidden', heightClasses[size])}>
        <div
          className={clsx('h-full transition-all duration-300 rounded-full', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
