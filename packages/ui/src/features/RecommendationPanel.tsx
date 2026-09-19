import React from 'react';
import { Target } from 'lucide-react';
import { Badge } from '../primitives/Badge';;
import { CandidateMaterialCard } from './CandidateMaterialCard';;
import { TeacherDecisionBar } from './TeacherDecisionBar';;
import type { RecommendationDTO } from '@acorn/contracts';

export interface RecommendationPanelProps {
  recommendation: RecommendationDTO;
  onDecision: (decision: 'ACCEPT' | 'MODIFY' | 'REJECT', notes?: string) => void;
  onCandidateAction: (action: 'REUSE' | 'ADAPT' | 'GENERATE', materialId: string) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendation,
  onDecision,
  onCandidateAction,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Recommended Action Card */}
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white rounded-2xl border border-blue-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0967F7] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="primary">{recommendation.priority} Priority</Badge>
                <Badge variant="default">Target: {recommendation.targetLevel}</Badge>
                <span className="text-xs text-[#656C79]">
                  Based on {recommendation.evidenceBasisCount} evidence items
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#082051] mb-2">
                {recommendation.recommendedActionText}
              </h2>
              <div className="space-y-1 mt-3">
                <span className="text-xs font-semibold text-[#082051]">Evidence Rationale:</span>
                <ul className="text-xs text-[#5969AB] list-disc list-inside space-y-0.5">
                  {recommendation.rationale.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Materials Strategy: Reuse -> Adapt -> Generate */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#082051]">
              Candidate Materials (Reuse → Adapt → Generate)
            </h3>
            <span className="text-xs text-[#656C79]">
              {recommendation.candidates.length} options ready
            </span>
          </div>
          <div className="space-y-3">
            {recommendation.candidates.map((candidate) => (
              <CandidateMaterialCard
                key={candidate.materialId}
                candidate={candidate}
                onAction={onCandidateAction}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Decision column */}
      <div>
        <TeacherDecisionBar onDecision={onDecision} />
      </div>
    </div>
  );
};
