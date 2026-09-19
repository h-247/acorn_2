import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={twMerge(
          clsx('rounded-full object-cover shrink-0 border border-gray-200', sizeClasses[size], className)
        )}
      />
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-full bg-[#E2E8F5] text-[#0967F7] font-semibold flex items-center justify-center shrink-0 border border-gray-200',
          sizeClasses[size],
          className
        )
      )}
    >
      {initials}
    </div>
  );
};
