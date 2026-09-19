import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ProgressBar } from '../primitives/ProgressBar';;
import { StatusBadge } from '../primitives/StatusBadge';;
import type { LearnerSkillDetailDTO } from '@acorn/contracts';

export interface LearnerSkillCardProps {
  skill: LearnerSkillDetailDTO;
  onSelectSubskill?: (subskillId: string) => void;
  onExploreEvidence?: (skillId: string) => void;
}

export const LearnerSkillCard: React.FC<LearnerSkillCardProps> = ({
  skill,
  onSelectSubskill,
  onExploreEvidence,
}) => {
  const [expanded, setExpanded] = useState(false);
  const score = skill.scorePercentage ?? (skill.score !== null ? Math.round(skill.score * 100) : null);
  const hasSubskills = skill.subskills && skill.subskills.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-4 transition-all hover:border-gray-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#F3F6FC] text-[#0967F7] flex items-center justify-center font-bold text-sm shrink-0">
            {skill.skillName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#082051] truncate">{skill.skillName}</span>
              <StatusBadge status={skill.confidence} />
            </div>
            <div className="text-xs text-[#656C79] mt-0.5">
              {skill.evidenceCount} evidence item{skill.evidenceCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-28 text-right">
            <div className="text-sm font-bold text-[#082051]">
              {score !== null ? `${score}%` : 'No data'}
            </div>
            {score !== null && <ProgressBar value={score} size="sm" color="blue" />}
          </div>

          {hasSubskills && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-[#656C79] hover:text-[#082051] rounded-md hover:bg-gray-100"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Subskills list */}
      {expanded && hasSubskills && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5 pl-6">
          {skill.subskills?.map((sub) => {
            const subScore =
              sub.scorePercentage ?? (sub.score !== null ? Math.round(sub.score * 100) : null);
            return (
              <div
                key={sub.skillId}
                onClick={() => onSelectSubskill && onSelectSubskill(sub.skillId)}
                className="flex items-center justify-between gap-3 py-1 cursor-pointer hover:bg-[#F3F6FC]/50 px-2 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#082051]">{sub.skillName}</span>
                  <StatusBadge status={sub.confidence} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#082051]">
                    {subScore !== null ? `${subScore}%` : 'No data'}
                  </span>
                  <div className="w-20">
                    {subScore !== null && <ProgressBar value={subScore} size="sm" color="blue" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
