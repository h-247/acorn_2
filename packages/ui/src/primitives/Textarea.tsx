import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#082051]">{label}</label>}
        <textarea
          ref={ref}
          className={twMerge(
            clsx(
              'w-full bg-white text-[#082051] placeholder-[#656C79] text-sm rounded-lg border border-gray-200 p-3 transition-colors focus:outline-none focus:border-[#0967F7] focus:ring-1 focus:ring-[#0967F7]',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className
            )
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#656C79]">{helperText}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
