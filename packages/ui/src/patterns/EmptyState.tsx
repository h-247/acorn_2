import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
      {icon ? (
        <div className="w-16 h-16 rounded-full bg-[#F3F6FC] flex items-center justify-center text-[#0967F7] mb-4">
          {icon}
        </div>
      ) : (
        <div className="text-4xl mb-3">🌰</div>
      )}
      <h3 className="text-lg font-semibold text-[#082051] mb-1">{title}</h3>
      <p className="text-sm text-[#656C79] max-w-sm mb-5">{description}</p>
      {action}
    </div>
  );
};
