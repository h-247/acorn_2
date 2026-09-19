import React from 'react';
import { StatusBadge } from '../primitives/StatusBadge';;
import type { LearningEvidenceDTO } from '@acorn/contracts';

export interface EvidenceDetailProps {
  evidence: LearningEvidenceDTO;
  onCorrect?: (newScore: number, reason: string) => void;
}

export const EvidenceDetail: React.FC<EvidenceDetailProps> = ({ evidence }) => {
  const isCorrect = evidence.normalizedScore >= 0.7;

  return (
    <div className="flex flex-col gap-5 text-[#082051]">
      <div className="flex items-center justify-between">
        <StatusBadge status={isCorrect ? 'correct' : 'incorrect'} />
        <span className="text-xs text-[#656C79]">
          {new Date(evidence.observedAt).toLocaleString()}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-[#656C79] uppercase tracking-wider mb-1">
          Question / Task
        </h4>
        <div className="bg-[#F3F6FC] rounded-xl p-3.5 text-sm">
          {evidence.questionPrompt || 'Standard skill prompt assessment'}
        </div>
      </div>

      {evidence.observedValue && (
        <div>
          <h4 className="text-xs font-semibold text-[#656C79] uppercase tracking-wider mb-1">
            Learner Response
          </h4>
          <div className="bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-mono text-xs">
            {evidence.observedValue}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 bg-[#F3F6FC]/60 p-3.5 rounded-xl text-xs">
        <div>
          <span className="text-[#656C79]">Skill Area:</span>
          <p className="font-semibold">{evidence.skillName}</p>
        </div>
        <div>
          <span className="text-[#656C79]">Normalized Score:</span>
          <p className="font-semibold">{Math.round(evidence.normalizedScore * 100)}%</p>
        </div>
        <div>
          <span className="text-[#656C79]">Weight:</span>
          <p className="font-semibold">{evidence.weight}x</p>
        </div>
        <div>
          <span className="text-[#656C79]">Evaluator:</span>
          <p className="font-semibold">{evidence.evaluatorType}</p>
        </div>
      </div>

      {evidence.sourceMaterialTitle && (
        <div>
          <h4 className="text-xs font-semibold text-[#656C79] uppercase tracking-wider mb-1">
            Source Material
          </h4>
          <p className="text-sm font-medium text-[#0967F7]">{evidence.sourceMaterialTitle}</p>
        </div>
      )}

      {evidence.isCorrected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <span className="font-semibold">Teacher corrected: </span>
          {evidence.correctionNotes || 'Manual teacher override applied.'}
        </div>
      )}
    </div>
  );
};
