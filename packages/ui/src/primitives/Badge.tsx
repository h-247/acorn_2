import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  size = 'md',
  ...props
}) => {
  const variantClasses = {
    default: 'bg-[#F3F6FC] text-[#5969AB]',
    primary: 'bg-blue-50 text-[#0967F7]',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium rounded-md',
    md: 'text-xs px-2.5 py-1 font-medium rounded-lg',
  };

  return (
    <span className={twMerge(clsx('inline-flex items-center gap-1', variantClasses[variant], sizeClasses[size], className))} {...props}>
      {children}
    </span>
  );
};
