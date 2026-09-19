import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles, FileText } from 'lucide-react';
import { Button } from '../primitives/Button';;
import { Badge } from '../primitives/Badge';;
import type { AICandidateDTO } from '@acorn/contracts';

export interface AICandidateReviewProps {
  candidate: AICandidateDTO;
  onApprove: () => void;
  onRevise: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export const AICandidateReview: React.FC<AICandidateReviewProps> = ({
  candidate,
  onApprove,
  onRevise,
  onReject,
  isLoading = false,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-[#656C79]">Provider:</span>
            <Badge variant="purple">{candidate.provider} ({candidate.model})</Badge>
            <span className="text-xs text-[#656C79]">
              Generated: {new Date(candidate.createdAt).toLocaleString()}
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#082051]">
            AI Candidate: {candidate.targetSkillName} ({candidate.targetLevel})
          </h2>
          <p className="text-xs text-[#656C79] mt-0.5">{candidate.promptSummary}</p>
        </div>

        {/* Validation Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${
              candidate.validation.isSchemaValid
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Schema Valid
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${
              candidate.validation.skillMappingPresent
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Skill Mapped
          </span>
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-amber-50 text-amber-700">
            <AlertCircle className="w-3.5 h-3.5" /> Teacher Review Required
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Content */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 text-[#082051] font-bold text-sm">
            <FileText className="w-4 h-4 text-[#656C79]" />
            <span>Source Content {candidate.sourceMaterialTitle && `(${candidate.sourceMaterialTitle})`}</span>
          </div>
          <div className="prose text-xs text-[#082051] whitespace-pre-wrap leading-relaxed max-h-[480px] overflow-y-auto">
            {candidate.sourceContent || 'No source content attached (new asset generation).'}
          </div>
        </div>

        {/* AI Candidate Version */}
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-100">
            <div className="flex items-center gap-2 text-[#0967F7] font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI Candidate Version</span>
            </div>
            <span className="text-[11px] bg-blue-50 text-[#0967F7] px-2 py-0.5 rounded-md font-medium">
              AI-assisted
            </span>
          </div>
          <div className="prose text-xs text-[#082051] whitespace-pre-wrap leading-relaxed max-h-[480px] overflow-y-auto bg-blue-50/20 p-3 rounded-xl border border-blue-100/60">
            {candidate.candidateContent}
          </div>

          {/* Generated Questions */}
          {candidate.generatedQuestions && candidate.generatedQuestions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-bold text-[#082051] mb-2">
                Generated Assessment Questions ({candidate.generatedQuestions.length})
              </h4>
              <div className="space-y-2">
                {candidate.generatedQuestions.map((q, idx) => (
                  <div key={idx} className="bg-[#F3F6FC] rounded-lg p-2.5 text-xs">
                    <p className="font-semibold text-[#082051]">{idx + 1}. {q.prompt}</p>
                    <div className="mt-1 space-y-0.5 pl-2 text-[#5969AB]">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={opt === q.correctAnswer ? 'font-bold text-emerald-700' : ''}>
                          • {opt} {opt === q.correctAnswer && '✓'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision Footer */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 flex items-center justify-between">
        <div className="text-xs text-[#656C79]">
          Remember: AI output is never canonical truth until teacher reviews and approves.
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="danger" size="md" onClick={onReject} disabled={isLoading}>
            Reject
          </Button>
          <Button variant="outline" size="md" onClick={onRevise} disabled={isLoading}>
            Edit / Revise
          </Button>
          <Button variant="primary" size="md" onClick={onApprove} loading={isLoading}>
            Approve & Publish ›
          </Button>
        </div>
      </div>
    </div>
  );
};
