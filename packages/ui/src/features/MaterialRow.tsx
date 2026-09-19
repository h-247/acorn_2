import React from 'react';
import { StatusBadge } from '../primitives/StatusBadge';;
import { Badge } from '../primitives/Badge';;
import type { MaterialDTO } from '@acorn/contracts';

export interface MaterialRowProps {
  material: MaterialDTO;
  onClick?: () => void;
  selected?: boolean;
}

export const MaterialRow: React.FC<MaterialRowProps> = ({ material, onClick, selected }) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'bg-blue-50/60 border-[#0967F7] shadow-xs'
          : 'bg-white border-gray-200/80 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#F3F6FC] text-[#0967F7] flex items-center justify-center font-bold text-sm shrink-0">
          📄
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-[#082051] truncate">{material.title}</span>
            <Badge variant="primary">{material.level}</Badge>
            <Badge variant="default">{material.type}</Badge>
          </div>
          <div className="text-xs text-[#656C79] flex items-center gap-2">
            <span>{material.primarySkillName}</span>
            <span>•</span>
            <span>{material.source}</span>
            <span>•</span>
            <span>v{material.currentVersionNumber}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <StatusBadge status={material.status} />
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-[#082051]">{material.usageCount} uses</div>
          <div className="text-[11px] text-[#656C79]">
            {new Date(material.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <span className="text-gray-400 text-sm">›</span>
      </div>
    </div>
  );
};
