import React from 'react';
import { Card } from '../primitives/Card';;

export interface MetricCardProps {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  description?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  value,
  label,
  description,
  onClick,
}) => {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className="flex items-center justify-between p-5 bg-white border border-gray-100 shadow-xs"
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-[#F3F6FC] flex items-center justify-center text-[#0967F7] shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="text-2xl font-bold text-[#082051] leading-none">{value}</div>
          <div className="text-sm font-medium text-[#656C79] mt-1">{label}</div>
          {description && <div className="text-xs text-[#5969AB] mt-0.5">{description}</div>}
        </div>
      </div>
      {onClick && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#656C79] hover:bg-[#F3F6FC] transition-colors">
          ›
        </div>
      )}
    </Card>
  );
};
