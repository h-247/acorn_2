'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  Card,
  RecommendationPanel,
  Dialog,
  Input,
  Select,
  ErrorState,
} from '@acorn/ui';
import { CheckCircle2, AlertCircle, ArrowRight, BookOpen, Send } from 'lucide-react';
import { api } from '@/lib/api';

export default function RecommendationWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [rec, setRec] = useState<any | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityText, setActivityText] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [submittingActivity, setSubmittingActivity] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecommendation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recData, clsList, matList, assList] = await Promise.all([
        api.getRecommendation(params.id),
        api.getClasses().catch(() => []),
        api.getMaterials().catch(() => []),
        api.getAssessments().catch(() => []),
      ]);
      setRec(recData);
      setClasses(clsList || []);
      setMaterials(matList || []);
      setAssessments(assList || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendation workspace');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadRecommendation();
  }, [loadRecommendation]);

  const handleDecision = async (decision: 'ACCEPT' | 'MODIFY' | 'REJECT', notes?: string) => {
    if (!rec) return;
    setError(null);
    try {
      await api.recordDecision(rec.id, {
        recommendationId: rec.id,
        decision,
        teacherNotes: notes,
        selectedMaterialId: rec.candidates?.[0]?.materialId,
      });
      setMessage(`Teacher decision recorded: ${decision}. Teacher decision is stored separately from curriculum assignment.`);
      setTimeout(() => setMessage(null), 4000);
      loadRecommendation();
    } catch (err: any) {
      setError(err.message || 'Failed to record teacher decision');
    }
  };

  const handleCandidateAction = (action: 'REUSE' | 'ADAPT' | 'NO_MATCH', materialId: string) => {
    if (action === 'REUSE') {
      router.push(`/materials/${materialId}`);
    } else if (action === 'ADAPT') {
      router.push(`/materials/${materialId}/adapt`);
    } else {
      router.push(`/materials/new`);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/learners" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading recommendation workspace...</div>
      </AppShell>
    );
  }

  if (error || !rec) {
    return (
      <AppShell currentPath="/learners" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load recommendation"
            message={error || 'Recommendation could not be computed or learner not found.'}
            onRetry={loadRecommendation}
          />
        </div>
      </AppShell>
    );
  }

  const initials = rec?.learnerName
    ? rec.learnerName
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ST';

  const handleAssignActivity = async () => {
    if (!rec) return;
    setSubmittingActivity(true);
    setError(null);
    try {
      await api.assignNextActivity(rec.id, {
        learnerId: rec.learnerId,
        classId: selectedClassId || undefined,
        materialId: selectedMaterialId || undefined,
        assessmentId: selectedAssessmentId || undefined,
        activityTitle: activityText || 'Recommended Practice Activity',
        instructions: activityText,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      setIsActivityModalOpen(false);
      setMessage(`Next activity assigned and scheduled separately from recommendation review.`);
      setTimeout(() => setMessage(null), 4000);
      loadRecommendation();
    } catch (err: any) {
      setError(err.message || 'Failed to assign next activity');
    } finally {
      setSubmittingActivity(false);
    }
  };

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Learners', href: '/learners' },
            { label: rec?.learnerName || 'Learner', href: `/learners/${params.id}` },
            { label: 'Recommendation' },
          ]}
          title="Recommendation Workspace"
          subtitle="Rule-based decision support grounded in authoritative learning evidence."
          actions={
            <Button
              variant="outline"
              size="md"
              icon={<Send className="w-4 h-4 text-[#0967F7]" />}
              onClick={() => {
                setActivityText(rec?.recommendedActionText || '');
                setSelectedMaterialId(rec?.candidates?.[0]?.materialId || '');
                setIsActivityModalOpen(true);
              }}
            >
              Assign Next Activity ›
            </Button>
          }
        />

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Learner Evidence Strip */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0967F7] font-bold flex items-center justify-center text-sm">
              {initials}
            </div>
            <div>
              <div className="text-sm font-bold text-[#082051]">{rec?.learnerName}</div>
              <div className="text-xs text-[#656C79]">
                Target Level: {rec?.targetLevel || 'B1'} • {rec?.evidenceBasisCount || 0} observations evaluated
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] text-[#656C79]">Target Focus:</span>
              <div className="text-xs font-bold text-[#082051]">{rec?.targetSkillName}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#656C79]">Evidence State:</span>
              <div className="text-xs font-bold text-[#0967F7]">
                {rec?.learnerCurrentScore != null
                  ? `${Math.round(rec.learnerCurrentScore * 100)}%`
                  : 'NO_DATA'}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#656C79]">Confidence:</span>
              <div className="text-xs font-bold text-amber-700">{rec?.learnerConfidence}</div>
            </div>
          </div>
        </div>

        {/* Core Recommendation Panel */}
        {rec && (
          <RecommendationPanel
            recommendation={rec}
            onDecision={handleDecision}
            onCandidateAction={handleCandidateAction}
          />
        )}

        {/* Dialog: Separate Next Activity Assignment */}
        <Dialog
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          title="Schedule Separate Next Activity"
        >
          <div className="space-y-4 text-xs">
            <p className="text-[#656C79]">
              In accordance with Acorn canonical invariants, teacher recommendation decision is kept strictly separate from curriculum assignment.
            </p>

            <Input
              label="Activity Title / Instructions"
              value={activityText}
              onChange={(e) => setActivityText(e.target.value)}
              placeholder="e.g. Practice B1 Inference with Adapted Passage"
            />

            <div>
              <label className="block text-xs font-medium text-[#082051] mb-1">
                Assign to Cohort / Class (Optional)
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white text-[#082051] focus:ring-2 focus:ring-[#0967F7] focus:outline-none"
              >
                <option value="">Individual Learner Only</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.code || 'Cohort'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#082051] mb-1">
                Attach Study Material (Optional)
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white text-[#082051] focus:ring-2 focus:ring-[#0967F7] focus:outline-none"
              >
                <option value="">None</option>
                {materials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.title} ({mat.level || mat.topic})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#082051] mb-1">
                Attach Assessment (Optional)
              </label>
              <select
                value={selectedAssessmentId}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white text-[#082051] focus:ring-2 focus:ring-[#0967F7] focus:outline-none"
              >
                <option value="">None</option>
                {assessments.map((ass) => (
                  <option key={ass.id} value={ass.id}>
                    {ass.title} ({ass.level || 'Assessment'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#082051] mb-1">
                Due Date & Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white text-[#082051] focus:ring-2 focus:ring-[#0967F7] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsActivityModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingActivity}
                onClick={handleAssignActivity}
              >
                Confirm Activity
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
