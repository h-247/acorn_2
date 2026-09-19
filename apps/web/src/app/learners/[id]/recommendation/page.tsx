'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  Card,
  RecommendationPanel,
} from '@acorn/ui';
import { api } from '@/lib/api';

export default function RecommendationWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [rec, setRec] = useState<any | null>(null);

  useEffect(() => {
    api.getRecommendation(params.id).then(setRec).catch(() => {});
  }, [params.id]);

  const handleDecision = async (decision: 'ACCEPT' | 'MODIFY' | 'REJECT', notes?: string) => {
    if (!rec) return;
    try {
      await api.recordDecision(rec.id, {
        recommendationId: rec.id,
        decision,
        teacherNotes: notes,
        selectedMaterialId: rec.candidates[0]?.materialId,
      });
      alert(`Teacher decision recorded: ${decision}!`);
      // Reload recommendation
      api.getRecommendation(params.id).then(setRec);
    } catch (err) {
      alert('Failed to record teacher decision');
    }
  };

  const handleCandidateAction = (action: 'REUSE' | 'ADAPT' | 'GENERATE', materialId: string) => {
    if (action === 'REUSE') {
      router.push(`/materials/${materialId}`);
    } else if (action === 'ADAPT') {
      router.push(`/materials/${materialId}/adapt`);
    } else {
      router.push(`/ai-review/dddddddd-dddd-dddd-dddd-dddddddddddd`);
    }
  };

  if (!rec) {
    return (
      <AppShell currentPath="/learners">
        <div className="p-8 text-center text-[#656C79]">Loading recommendation workspace...</div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Learners', href: '/learners' },
            { label: rec.learnerName, href: `/learners/${params.id}` },
            { label: 'Recommendation' },
          ]}
          title="Recommendation Workspace"
          subtitle="Choose the next best English learning activity based on evidence and class goals."
        />

        {/* Learner Evidence Strip */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0967F7] font-bold flex items-center justify-center">
              EN
            </div>
            <div>
              <div className="text-sm font-bold text-[#082051]">{rec.learnerName}</div>
              <div className="text-xs text-[#656C79]">IELTS Foundation A • Target Level {rec.targetLevel}</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] text-[#656C79]">Target Focus:</span>
              <div className="text-xs font-bold text-[#082051]">{rec.targetSkillName}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#656C79]">Current State:</span>
              <div className="text-xs font-bold text-[#0967F7]">{Math.round((rec.learnerCurrentScore || 0.54) * 100)}%</div>
            </div>
            <div>
              <span className="text-[11px] text-[#656C79]">Confidence:</span>
              <div className="text-xs font-bold text-amber-700">{rec.learnerConfidence}</div>
            </div>
          </div>
        </div>

        {/* Core Recommendation Panel */}
        <RecommendationPanel
          recommendation={rec}
          onDecision={handleDecision}
          onCandidateAction={handleCandidateAction}
        />
      </div>
    </AppShell>
  );
}
