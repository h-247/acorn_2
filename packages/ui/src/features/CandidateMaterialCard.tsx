import React from 'react';
import { Button } from '../primitives/Button';;
import { Badge } from '../primitives/Badge';;
import type { CandidateMaterialDTO } from '@acorn/contracts';

export interface CandidateMaterialCardProps {
  candidate: CandidateMaterialDTO;
  onAction: (action: 'REUSE' | 'ADAPT' | 'GENERATE', materialId: string) => void;
  onPreview?: (materialId: string) => void;
}

export const CandidateMaterialCard: React.FC<CandidateMaterialCardProps> = ({
  candidate,
  onAction,
  onPreview,
}) => {
  const actionColorMap = {
    REUSE: 'primary',
    ADAPT: 'secondary',
    GENERATE: 'outline',
  } as const;

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-4 hover:border-gray-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold text-[#082051]">{candidate.title}</span>
          <Badge variant="primary">{candidate.level}</Badge>
          <Badge variant="default">{candidate.type}</Badge>
          <span className="text-xs text-[#656C79]">{candidate.estimatedMinutes} min</span>
        </div>
        <p className="text-xs text-[#656C79] mb-2">{candidate.matchReason}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {candidate.tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-[#F3F6FC] text-[#5969AB] px-2 py-0.5 rounded-md font-medium">
              #{tag}
            </span>
          ))}
          {candidate.previouslyUsedCount > 0 && (
            <span className="text-[10px] text-emerald-700 font-medium">
              Used {candidate.previouslyUsedCount}x
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onPreview && (
          <Button variant="ghost" size="sm" onClick={() => onPreview(candidate.materialId)}>
            Preview
          </Button>
        )}
        <Button
          variant={actionColorMap[candidate.action]}
          size="sm"
          onClick={() => onAction(candidate.action, candidate.materialId)}
        >
          {candidate.action === 'REUSE'
            ? 'Reuse'
            : candidate.action === 'ADAPT'
            ? 'Adapt'
            : 'Generate'}
        </Button>
      </div>
    </div>
  );
};
