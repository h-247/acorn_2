import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#082051]">{label}</label>}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-[#656C79] pointer-events-none">{leftIcon}</div>}
          <input
            ref={ref}
            className={twMerge(
              clsx(
                'w-full bg-white text-[#082051] placeholder-[#656C79] text-sm rounded-lg border border-gray-200 px-3 py-2 transition-colors focus:outline-none focus:border-[#0967F7] focus:ring-1 focus:ring-[#0967F7]',
                leftIcon && 'pl-9',
                rightIcon && 'pr-9',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                className
              )
            )}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-[#656C79]">{rightIcon}</div>}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#656C79]">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

