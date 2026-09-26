'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  StatusBadge,
  Card,
  Drawer,
  Select,
  Input,
  ErrorState,
} from '@acorn/ui';
import { Send, Clock, CheckCircle2, BookOpen, AlertCircle, Check, XCircle, Edit2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentDetailPage({ params }: { params: { id: string } }) {
  const [assessment, setAssessment] = useState<any | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
  // Whole class, or the learners ticked below. Naming learners never widens
  // to the rest of the class.
  const [assignScope, setAssignScope] = useState<'CLASS' | 'LEARNERS'>('CLASS');
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [pickedLearnerIds, setPickedLearnerIds] = useState<string[]>([]);
  const [assignedSuccess, setAssignedSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // What stands between this draft and READY, straight from the backend so the
  // two can never disagree about whether the paper is publishable.
  const [readiness, setReadiness] = useState<{ ready: boolean; faults: string[] } | null>(null);

  const loadAssessment = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [assData, clsList] = await Promise.all([
        api.getAssessment(params.id),
        api.getClasses(),
      ]);
      setAssessment(assData);
      setClasses(clsList || []);

      if (assData?.status === 'DRAFT' || assData?.status === 'READY') {
        try {
          setReadiness(await api.getAssessmentReadiness(params.id));
        } catch {
          setReadiness(null);
        }
      } else {
        setReadiness(null);
      }
      if (clsList && clsList.length > 0) {
        setSelectedClassId((prev) => prev || clsList[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const handleMarkReady = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.markAssessmentReady(params.id);
      loadAssessment();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to mark this assessment ready');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.publishAssessment(params.id);
      loadAssessment();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish assessment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this assessment? No further submissions can be started.')) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.closeAssessment(params.id);
      loadAssessment();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to close assessment');
    } finally {
      setActionLoading(false);
    }
  };

  // The roster is only needed once the teacher asks to pick individuals.
  useEffect(() => {
    if (!isAssignDrawerOpen || assignScope !== 'LEARNERS' || !selectedClassId) return;
    let cancelled = false;

    (async () => {
      setRosterLoading(true);
      try {
        const res = await api.getClassEnrollments(selectedClassId, { all: true });
        if (cancelled) return;
        setRoster(Array.isArray(res) ? res : res?.items || []);
      } catch (err: any) {
        if (!cancelled) setErrorMessage(err.message || 'Failed to load the class roster');
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAssignDrawerOpen, assignScope, selectedClassId]);

  const toggleLearner = (learnerId: string) =>
    setPickedLearnerIds((prev) =>
      prev.includes(learnerId) ? prev.filter((x) => x !== learnerId) : [...prev, learnerId]
    );

  const handleAssign = async () => {
    if (!selectedClassId) {
      setErrorMessage('Please select a class cohort.');
      return;
    }
    if (assignScope === 'LEARNERS' && pickedLearnerIds.length === 0) {
      setErrorMessage('Pick at least one learner, or assign to the whole class.');
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.assignAssessment(params.id, {
        classId: selectedClassId,
        learnerIds: assignScope === 'LEARNERS' ? pickedLearnerIds : undefined,
        dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setAssignedSuccess(true);
      setTimeout(() => {
        setIsAssignDrawerOpen(false);
        setAssignedSuccess(false);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to assign assessment');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/assessments" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading assessment...</div>
      </AppShell>
    );
  }

  if (errorMessage && !assessment) {
    return (
      <AppShell currentPath="/assessments" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load assessment"
            message={errorMessage}
            onRetry={loadAssessment}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Assessments', href: '/assessments' },
            { label: assessment?.title || 'Detail' },
          ]}
          title={assessment?.title || 'Assessment Detail'}
          subtitle={assessment?.description || 'Structured English skill assessment'}
          badge={<StatusBadge status={assessment?.status || 'DRAFT'} />}
          actions={
            <div className="flex items-center gap-2">
              {(assessment?.status === 'DRAFT' || assessment?.status === 'READY') && (
                <Button
                  variant="outline"
                  size="md"
                  icon={<Edit2 className="w-4 h-4" />}
                  onClick={() => { window.location.href = `/assessments/builder?draftId=${params.id}`; }}
                >
                  Edit draft
                </Button>
              )}

              {assessment?.status === 'DRAFT' && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Check className="w-4 h-4 text-emerald-600" />}
                  loading={actionLoading}
                  disabled={readiness ? !readiness.ready : false}
                  onClick={handleMarkReady}
                >
                  Mark Ready
                </Button>
              )}

              {assessment?.status === 'READY' && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Check className="w-4 h-4 text-emerald-600" />}
                  loading={actionLoading}
                  onClick={handlePublish}
                >
                  Publish Assessment
                </Button>
              )}

              {assessment?.status === 'PUBLISHED' && (
                <>
                  <Button
                    variant="outline"
                    size="md"
                    icon={<XCircle className="w-4 h-4 text-amber-600" />}
                    loading={actionLoading}
                    onClick={handleClose}
                  >
                    Close Assessment
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Send className="w-4 h-4" />}
                    onClick={() => setIsAssignDrawerOpen(true)}
                  >
                    Assign to Class
                  </Button>
                </>
              )}
            </div>
          }
        />

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {assessment?.status === 'DRAFT' && readiness && !readiness.ready && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <div className="flex items-center gap-2 font-semibold mb-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>This assessment cannot be published yet</span>
            </div>
            <ul className="list-disc pl-6 space-y-0.5 font-medium">
              {readiness.faults.map((fault, i) => (
                <li key={i}>{fault}</li>
              ))}
            </ul>
          </div>
        )}

        {assessment?.status === 'READY' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Checked and ready. Publishing makes it assignable; editing it sends it back to draft.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-[#082051]">
              Assessment Questions ({assessment?.items?.length || 0})
            </h3>

            {assessment?.items && assessment.items.length > 0 ? (
              assessment.items.map((it: any, idx: number) => (
                <Card key={it.id} className="p-5 border-gray-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2 py-0.5 rounded">
                      Question {idx + 1}
                    </span>
                    <Badge variant="primary">{it.question?.type || 'MCQ'}</Badge>
                  </div>
                  <p className="text-sm font-bold text-[#082051]">{it.question?.prompt}</p>
                  {it.question?.options && (
                    <div className="space-y-1 pl-2">
                      {it.question.options.map((opt: string, oIdx: number) => (
                        <div
                          key={oIdx}
                          className={`text-xs p-1.5 rounded ${
                            opt === it.question.correctAnswer
                              ? 'bg-emerald-50 text-emerald-800 font-semibold'
                              : 'text-[#656C79]'
                          }`}
                        >
                          • {opt} {opt === it.question.correctAnswer && '✓'}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center text-xs text-[#656C79] border-dashed">
                No questions added to this assessment yet.
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5 border-gray-200/80 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-[#082051]">Assessment Properties</h3>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Level:</span>
                <Badge variant="primary">{assessment?.level}</Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Time limit:</span>
                <span className="font-semibold text-[#082051]">{assessment?.timeLimitMinutes || 20} mins</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Total points:</span>
                <span className="font-semibold text-[#082051]">{assessment?.totalPoints || 0} points</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Status:</span>
                <span className="font-semibold text-[#082051]">{assessment?.status}</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Assign Drawer */}
        <Drawer
          isOpen={isAssignDrawerOpen}
          onClose={() => setIsAssignDrawerOpen(false)}
          title="Assign Assessment"
        >
          <div className="space-y-5">
            {assignedSuccess ? (
              <div className="p-8 text-center bg-emerald-50 text-emerald-800 rounded-2xl">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
                <h3 className="text-lg font-bold">Successfully Assigned!</h3>
                <p className="text-xs mt-1">
                  {assignScope === 'LEARNERS'
                    ? `${pickedLearnerIds.length} learner${
                        pickedLearnerIds.length === 1 ? '' : 's'
                      } received this checkpoint.`
                    : 'Learners in this class have received their assessment checkpoints.'}
                </p>
              </div>
            ) : (
              <>
                <Select
                  label="Select Class Cohort"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  options={classes.map((c) => ({
                    label: `${c.name} (${c.learnerCount || 0} learners)`,
                    value: c.id,
                  }))}
                />

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#082051]">Assign to</span>
                  <div className="flex gap-2">
                    {(['CLASS', 'LEARNERS'] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setAssignScope(scope)}
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                          assignScope === scope
                            ? 'border-[#0967F7] bg-blue-50 text-[#0967F7]'
                            : 'border-gray-200 text-[#656C79] hover:border-gray-300'
                        }`}
                      >
                        {scope === 'CLASS' ? 'Whole class' : 'Selected learners'}
                      </button>
                    ))}
                  </div>
                </div>

                {assignScope === 'LEARNERS' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#082051]">
                        Learners ({pickedLearnerIds.length} selected)
                      </span>
                      {roster.length > 0 && (
                        <button
                          type="button"
                          className="text-[#0967F7] font-semibold hover:underline"
                          onClick={() =>
                            setPickedLearnerIds(
                              pickedLearnerIds.length === roster.length
                                ? []
                                : roster.map((r) => r.learnerId)
                            )
                          }
                        >
                          {pickedLearnerIds.length === roster.length ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {rosterLoading ? (
                        <p className="p-3 text-xs text-[#656C79]">Loading the roster...</p>
                      ) : roster.length === 0 ? (
                        <p className="p-3 text-xs text-[#656C79]">No learners enrolled in this class.</p>
                      ) : (
                        roster.map((r) => (
                          <label
                            key={r.learnerId}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={pickedLearnerIds.includes(r.learnerId)}
                              onChange={() => toggleLearner(r.learnerId)}
                              className="w-3.5 h-3.5"
                            />
                            <span className="font-medium text-[#082051]">{r.learnerName}</span>
                            <span className="text-[#656C79] ml-auto">{r.learnerEmail}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Input
                  label="Due Date (Optional)"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />

                <Button
                  variant="primary"
                  size="md"
                  loading={actionLoading}
                  onClick={handleAssign}
                  className="w-full"
                >
                  Confirm Assignment
                </Button>
              </>
            )}
          </div>
        </Drawer>
      </div>
    </AppShell>
  );
}
