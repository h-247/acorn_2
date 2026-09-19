import React from 'react';
import { StatusBadge } from '../primitives/StatusBadge';;
import type { LearningEvidenceDTO } from '@acorn/contracts';

export interface EvidenceRowProps {
  evidence: LearningEvidenceDTO;
  onClick?: () => void;
  selected?: boolean;
}

export const EvidenceRow: React.FC<EvidenceRowProps> = ({ evidence, onClick, selected }) => {
  const isCorrect = evidence.normalizedScore >= 0.7;
  const statusType = isCorrect ? 'correct' : 'incorrect';
  const displayScore = Math.round(evidence.normalizedScore * 100);

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'bg-blue-50/60 border-[#0967F7] shadow-xs'
          : 'bg-white border-gray-200/80 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <StatusBadge status={statusType} label={isCorrect ? 'Correct' : 'Needs work'} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#082051] truncate">
            {evidence.questionPrompt || evidence.assessmentTitle || 'Question Evidence'}
          </div>
          <div className="text-xs text-[#656C79] mt-0.5">
            {evidence.skillName} • Weight: {evidence.weight} • {evidence.evaluatorType}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-right">
        <div>
          <span className="text-sm font-bold text-[#082051]">{displayScore}%</span>
          <div className="text-[11px] text-[#656C79]">
            {new Date(evidence.observedAt).toLocaleDateString()}
          </div>
        </div>
        <span className="text-gray-400 text-sm">›</span>
      </div>
    </div>
  );
};
