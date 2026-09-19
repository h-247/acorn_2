import React from 'react';

export interface DistributionItem {
  label: string;
  value: number; // percentage
  highlight?: boolean;
}

export interface DistributionChartProps {
  items: DistributionItem[];
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ items }) => {
  return (
    <div className="flex items-end justify-between gap-3 h-32 pt-4 px-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <span className="text-xs font-semibold text-[#082051]">{item.value}%</span>
          <div className="w-full max-w-[48px] bg-gray-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-20">
            <div
              className={`w-full rounded-t-lg transition-all duration-300 ${
                item.highlight ? 'bg-[#0967F7]' : 'bg-[#E2E8F5]'
              }`}
              style={{ height: `${item.value}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-[#656C79] truncate max-w-full">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
