import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#082051]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={twMerge(
          clsx(
            'relative w-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 z-10 animate-in zoom-in-95 duration-150',
            maxWidth,
            className
          )
        )}
      >
        {title && (
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-[#082051]">{title}</h3>
            {description && <p className="text-sm text-[#656C79] mt-1">{description}</p>}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};
