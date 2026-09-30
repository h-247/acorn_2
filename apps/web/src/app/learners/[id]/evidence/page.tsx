'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  StatusBadge,
  Card,
  EvidenceRow,
  EvidenceDetail,
  Dialog,
  Input,
  Textarea,
  ProgressTrend,
  ErrorState,
  EmptyState,
} from '@acorn/ui';
import { Download, ArrowLeft, Filter, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * How many observations to ask for at once.
 *
 * The endpoint caps at 100. Asking for the cap and then saying plainly when the
 * answer is full is more honest than asking for 20 and printing the number as
 * though it were the whole history.
 */
const EVIDENCE_PAGE_SIZE = 100;

export default function EvidenceExplorerPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const skillFilter = searchParams.get('skillId');
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [newScorePercent, setNewScorePercent] = useState('100');
  const [correctionReason, setCorrectionReason] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = [
        `learnerId=${params.id}`,
        `limit=${EVIDENCE_PAGE_SIZE}`,
        skillFilter ? `skillId=${skillFilter}` : '',
      ]
        .filter(Boolean)
        .join('&');

      const list = await api.getEvidence(query);
      setEvidenceList(list || []);
      if (list && list.length > 0) {
        setSelectedEvidence((prev: any) => {
          if (!prev) return list[0];
          const updated = list.find((e: any) => e.id === prev.id);
          return updated || list[0];
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load evidence items');
    } finally {
      setLoading(false);
    }
  }, [params.id, skillFilter]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidence) return;
    if (!correctionReason.trim()) {
      setError('A correction reason is required for the immutable audit trail.');
      return;
    }
    const parsedPercent = parseFloat(newScorePercent);
    if (isNaN(parsedPercent) || parsedPercent < 0 || parsedPercent > 100) {
      setError('Score percentage must be a valid number between 0 and 100.');
      return;
    }
    setSavingCorrection(true);
    setError(null);
    try {
      const normScore = Math.max(0, Math.min(1, parsedPercent / 100));
      await api.correctEvidence(selectedEvidence.id, {
        correctedNormalizedScore: normScore,
        reason: correctionReason.trim(),
      });
      setIsCorrectModalOpen(false);
      setCorrectionReason('');
      setMessage('Evidence corrected! Learner skill state and progression recomputed.');
      setTimeout(() => setMessage(null), 4000);
      loadEvidence();
    } catch (err: any) {
      setError(err.message || 'Failed to correct evidence');
    } finally {
      setSavingCorrection(false);
    }
  };

  const trendData = evidenceList.length > 0
    ? [...evidenceList].reverse().map((e) => ({
        label: new Date(e.observedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round((e.normalizedScore ?? 0) * 100),
      }))
    : [
        { label: 'No data', value: 0 },
      ];

  const learnerName = evidenceList[0]?.learnerName || 'Learner';
  const observedSkill = evidenceList[0]?.skillName || 'General English';
  const correctedCount = evidenceList.filter((e) => e.isCorrected).length;
  const lastUpdated = evidenceList[0]?.observedAt
    ? new Date(evidenceList[0].observedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No observations';

  const averageScore = evidenceList.length > 0
    ? Math.round(
        (evidenceList.reduce((sum, e) => sum + (e.normalizedScore ?? 0) * (e.weight ?? 1), 0) /
          evidenceList.reduce((sum, e) => sum + (e.weight ?? 1), 0)) *
          100
      )
    : null;

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Learners', href: '/learners' },
            { label: learnerName, href: `/learners/${params.id}` },
            { label: 'Evidence Explorer' },
          ]}
          title="Evidence Explorer"
          subtitle={`${observedSkill} • Current state ${averageScore != null ? `${averageScore}%` : 'NO_DATA'} • ${evidenceList.length} observation(s)`}
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

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading evidence observations...</div>
        ) : error && evidenceList.length === 0 ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load evidence items"
              message={error}
              onRetry={loadEvidence}
            />
          </div>
        ) : evidenceList.length === 0 ? (
          <EmptyState
            title="No evidence observations found"
            description="No assessment answers or teacher evaluations have been recorded for this learner yet."
          />
        ) : (
          <>
            {/* Snapshot Metric Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border-gray-200/80">
                <span className="text-xs text-[#656C79]">Learner</span>
                <div className="text-sm font-bold text-[#082051] mt-0.5">{learnerName}</div>
                <span className="text-[11px] text-[#5969AB]">Tracked Evidence</span>
              </Card>
              <Card className="p-4 border-gray-200/80">
                <span className="text-xs text-[#656C79]">Observed Skill</span>
                <div className="text-sm font-bold text-[#082051] mt-0.5">{observedSkill}</div>
                <span className="text-[11px] text-[#5969AB]">Skill Taxonomy Node</span>
              </Card>
              <Card className="p-4 border-gray-200/80">
                <span className="text-xs text-[#656C79]">
                  {skillFilter ? 'Evidence for this skill' : 'Evidence retained'}
                </span>
                <div className="text-sm font-bold text-[#082051] mt-0.5">
                  {evidenceList.length >= EVIDENCE_PAGE_SIZE
                    ? `${EVIDENCE_PAGE_SIZE}+ items`
                    : `${evidenceList.length} items`}
                </div>
                <span className="text-[11px] text-amber-700">{correctedCount} teacher-corrected</span>
              </Card>
              <Card className="p-4 border-gray-200/80">
                <span className="text-xs text-[#656C79]">Last updated</span>
                <div className="text-sm font-bold text-[#082051] mt-0.5">{lastUpdated}</div>
                <span className="text-[11px] text-[#5969AB]">PostgreSQL Authoritative</span>
              </Card>
            </div>

            {/* Trend Graph */}
            <Card className="p-6 border-gray-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#082051]">
                    Evidence progression trend ({observedSkill})
                  </h3>
                  <p className="text-xs text-[#656C79]">Weighted chronological observations</p>
                </div>
                <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2.5 py-1 rounded-md">
                  Current: {averageScore != null ? `${averageScore}%` : 'NO_DATA'}
                </span>
              </div>
              <ProgressTrend data={trendData} height={140} />
            </Card>

            {/* Main List and Drilldown Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#082051]">
                    {skillFilter ? 'Evidence for this skill' : 'Retained Evidence'} (
                    {evidenceList.length >= EVIDENCE_PAGE_SIZE
                      ? `most recent ${EVIDENCE_PAGE_SIZE}`
                      : `${evidenceList.length} items`}
                    )
                  </h3>
                  {skillFilter && (
                    <a
                      href={`/learners/${params.id}/evidence`}
                      className="text-xs font-bold text-[#0967F7] hover:underline"
                    >
                      Show all skills
                    </a>
                  )}
                </div>

                <div className="space-y-2.5">
                  {evidenceList.map((e) => (
                    <EvidenceRow
                      key={e.id}
                      evidence={e}
                      selected={selectedEvidence?.id === e.id}
                      onClick={() => setSelectedEvidence(e)}
                    />
                  ))}
                </div>
              </div>

              {/* Drilldown Drawer / Card */}
              <div>
                <Card className="p-5 border-gray-200/80 sticky top-24 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-[#082051]">
                      Evidence Inspection
                    </h3>
                    {selectedEvidence && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setNewScorePercent(String(Math.round((selectedEvidence.normalizedScore || 0) * 100)));
                          setIsCorrectModalOpen(true);
                        }}
                      >
                        Correct
                      </Button>
                    )}
                  </div>

                  {selectedEvidence ? (
                    <EvidenceDetail evidence={selectedEvidence} />
                  ) : (
                    <div className="text-xs text-[#656C79]">Select an evidence row to inspect.</div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Dialog: Correct Evidence */}
        <Dialog
          isOpen={isCorrectModalOpen}
          onClose={() => setIsCorrectModalOpen(false)}
          title="Teacher Evidence Correction"
        >
          <form onSubmit={handleCorrect} className="space-y-4 text-xs">
            <p className="text-[#656C79]">
              Corrections maintain an immutable audit trail and trigger immediate recomputation of the learner&apos;s skill state.
            </p>

            <Input
              label="Corrected Score (%)"
              type="number"
              min="0"
              max="100"
              value={newScorePercent}
              onChange={(e) => setNewScorePercent(e.target.value)}
              required
            />

            <Textarea
              label="Audit Reason & Pedagogical Justification"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Explain why this evidence score is being adjusted..."
              rows={3}
              required
            />

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsCorrectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={savingCorrection}
              >
                Save Correction & Recompute State
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
