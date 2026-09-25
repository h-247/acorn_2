'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  StatusBadge,
  Card,
  Textarea,
  Input,
  ErrorState,
} from '@acorn/ui';
import { Check, ArrowLeft, CheckCircle2, AlertCircle, Volume2, Mic } from 'lucide-react';
import { api } from '@/lib/api';



export default function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [submission, setSubmission] = useState<any | null>(null);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Question evaluations keyed by questionId
  const [evaluations, setEvaluations] = useState<
    Record<
      string,
      {
        rawScore: number;
        maxScore: number;
        isCorrect?: boolean;
        rubricScores?: Record<string, number>;
        teacherFeedback?: string;
      }
    >
  >({});

  // Audio URLs for speaking questions
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const sub = await api.getSubmission(params.id);
      setSubmission(sub);
      if (sub?.teacherFeedback) {
        setOverallFeedback(sub.teacherFeedback);
      }

      // Initialize evaluations for each item
      const initialEvals: Record<string, any> = {};
      const items = sub?.items || [];

      for (const item of items) {
        const qId = item.questionId;
        const q = item.question;
        const r = item.response;
        let maxScore = item.points || 10;
        // G02: If it's WRITING/SPEAKING, calculate maxScore from the rubric to override legacy points=1.0
        if (q?.type === 'WRITING' || q?.type === 'SPEAKING') {
          let rubricMax = 0;
          if (q.rubric) {
            try {
              const parsed = typeof q.rubric === 'string' ? JSON.parse(q.rubric) : q.rubric;
              if (Array.isArray(parsed)) {
                rubricMax = parsed.reduce((sum: number, c: any) => sum + (c.maxScore || 0), 0);
              }
            } catch (e) {
              // fallback below
            }
          }
          if (rubricMax > 0) {
            maxScore = rubricMax;
          } else {
            // Default legacy 4x20 rubric
            maxScore = 80;
          }
        }

        if (q?.type === 'WRITING' || q?.type === 'SPEAKING') {
          let parsedRubric: any[] = [];
          if (q.rubric) {
            try {
              parsedRubric = typeof q.rubric === 'string' ? JSON.parse(q.rubric) : q.rubric;
            } catch (e) {}
          }
          if (!Array.isArray(parsedRubric)) {
            parsedRubric = [];
          }

          const defaultRubricScores: Record<string, number> = {};
          for (const c of parsedRubric) {
            defaultRubricScores[c.criteria] = c.maxScore || 0;
          }

          const rubric = r?.rubricScores || defaultRubricScores;
          const raw = Object.values(rubric).reduce((a: number, b: any) => a + Number(b), 0);
          initialEvals[qId] = {
            rawScore: r?.rawScore ?? raw,
            maxScore,
            isCorrect: r?.isCorrect ?? true,
            rubricScores: rubric,
            teacherFeedback: r?.teacherFeedback || '',
          };
        } else {
          // MCQ or SHORT_ANSWER
          const isCorrect = r?.isCorrect ?? (r?.rawScore !== undefined ? r.rawScore > 0 : false);
          initialEvals[qId] = {
            rawScore: r?.rawScore ?? (isCorrect ? maxScore : 0),
            maxScore,
            isCorrect,
            teacherFeedback: r?.teacherFeedback || '',
          };
        }
      }

      setEvaluations(initialEvals);

      // Fetch audio for speaking questions if available
      for (const item of items) {
        if (item.question?.type === 'SPEAKING') {
          fetchAudio(sub.id, item.questionId);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load submission review');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchAudio = async (subId: string, qId: string) => {
    setAudioLoading((prev) => ({ ...prev, [qId]: true }));
    try {
      const res = await api.getSubmissionAudioUrl(subId, qId);
      const audioSrc = res?.audioUrl || res?.url;
      if (audioSrc) {
        setAudioUrls((prev) => ({ ...prev, [qId]: audioSrc }));
      }
    } catch (e) {
      // Audio might not have been recorded or uploaded
    } finally {
      setAudioLoading((prev) => ({ ...prev, [qId]: false }));
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  // Total raw score and max score calculation
  const totalRaw = Object.values(evaluations).reduce((acc, curr) => acc + (curr.rawScore || 0), 0);
  const totalMax = Object.values(evaluations).reduce((acc, curr) => acc + (curr.maxScore || 0), 0);
  const totalPercentage = totalMax > 0 ? Math.round((totalRaw / totalMax) * 100) : 0;

  const updateRubricScore = (
    questionId: string,
    rubricKey: string,
    val: number
  ) => {
    setEvaluations((prev) => {
      const current = prev[questionId] || { rawScore: 0, maxScore: 100 };
      const currentRubrics = current.rubricScores || {};
      const newRubrics = { ...currentRubrics, [rubricKey]: val };
      const newRaw = Object.values(newRubrics).reduce((a, b) => a + Number(b), 0);
      return {
        ...prev,
        [questionId]: {
          ...current,
          rubricScores: newRubrics,
          rawScore: newRaw,
        },
      };
    });
  };

  const updateRawScore = (questionId: string, score: number) => {
    setEvaluations((prev) => {
      const current = prev[questionId] || { rawScore: 0, maxScore: 10 };
      return {
        ...prev,
        [questionId]: {
          ...current,
          rawScore: Math.min(current.maxScore, Math.max(0, score)),
          isCorrect: score >= current.maxScore * 0.7,
        },
      };
    });
  };

  const updateFeedback = (questionId: string, text: string) => {
    setEvaluations((prev) => {
      const current = prev[questionId] || { rawScore: 0, maxScore: 10 };
      return {
        ...prev,
        [questionId]: {
          ...current,
          teacherFeedback: text,
        },
      };
    });
  };

  const handleFinalize = async () => {
    if (!submission) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const items = submission.items || [];
      const responsesPayload = items.map((item: any) => {
        const qId = item.questionId;

        let dynamicMax = item.points || 10;
        if (item.question?.type === 'WRITING' || item.question?.type === 'SPEAKING') {
          let rubricMax = 0;
          if (item.question.rubric) {
            try {
              const parsed = typeof item.question.rubric === 'string' ? JSON.parse(item.question.rubric) : item.question.rubric;
              if (Array.isArray(parsed)) {
                rubricMax = parsed.reduce((sum: number, c: any) => sum + (c.maxScore || 0), 0);
              }
            } catch (e) {}
          }
          dynamicMax = rubricMax > 0 ? rubricMax : 80;
        }

        const ev = evaluations[qId] || {
          rawScore: 0,
          maxScore: dynamicMax,
        };
        return {
          questionId: qId,
          rawScore: ev.rawScore,
          maxScore: ev.maxScore,
          isCorrect: ev.isCorrect,
          rubricScores: ev.rubricScores,
          teacherFeedback: ev.teacherFeedback,
        };
      });

      await api.evaluate(submission.id, {
        submissionId: submission.id,
        responses: responsesPayload,
        overallTeacherFeedback: overallFeedback,
      });
      router.push('/submissions');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to finalize evaluation');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/submissions" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading submission review...</div>
      </AppShell>
    );
  }

  if (errorMessage && !submission) {
    return (
      <AppShell currentPath="/submissions" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load submission"
            message={errorMessage}
            onRetry={loadSubmission}
          />
        </div>
      </AppShell>
    );
  }

  const items = submission?.items || [];

  return (
    <AppShell currentPath="/submissions" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Submissions', href: '/submissions' },
            { label: 'Review' },
          ]}
          title="Submission Review & Grading"
          subtitle="Review answers, listen to spoken responses, adjust auto-grading, and score rubrics."
          actions={
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={handleFinalize}
              icon={<Check className="w-4 h-4" />}
            >
              Finalize evaluation ›
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Summary Strip */}
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-[#656C79]">Assessment</span>
            <div className="text-sm font-bold text-[#082051]">{submission?.assessmentTitle}</div>
            <span className="text-[11px] text-[#5969AB]">
              Submitted:{' '}
              {submission?.submittedAt
                ? new Date(submission.submittedAt).toLocaleDateString()
                : 'Pending'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[#656C79]">Learner</span>
              <div className="text-sm font-bold text-[#082051]">{submission?.learnerName}</div>
            </div>
            <div>
              <span className="text-xs text-[#656C79]">Calculated Score</span>
              <div className="text-lg font-bold text-[#0967F7]">
                {totalRaw} / {totalMax} ({totalPercentage}%)
              </div>
            </div>
            <div>
              <span className="text-xs text-[#656C79]">Status</span>
              <div>
                <Badge variant={submission?.status === 'EVALUATED' ? 'success' : 'primary'}>
                  {submission?.status || 'SUBMITTED'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Teacher Feedback Card */}
        <Card className="p-5 border-gray-200/80">
          <Textarea
            label="Overall Assessment Feedback"
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            placeholder="Provide comprehensive feedback and learning guidance for the student..."
            rows={3}
            className="text-xs"
          />
        </Card>

        {/* Multi-question review list */}
        <div className="space-y-6">
          {items.map((item: any, idx: number) => {
            const q = item.question || {};
            const r = item.response || {};
            const qId = item.questionId;
            const ev = evaluations[qId] || { rawScore: 0, maxScore: item.points || 10 };
            const audioUrl = audioUrls[qId] || (typeof r.responsePayload === 'object' ? r.responsePayload?.audioUrl : null);

            return (
              <Card key={qId} className="p-6 border-gray-200/80 space-y-4">
                {/* Question Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-[#0967F7] text-white px-2.5 py-0.5 rounded-md">
                      Question {idx + 1}
                    </span>
                    <Badge variant="default">{q.type || 'QUESTION'}</Badge>
                    {q.difficulty && <Badge variant="primary">{q.difficulty}</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#656C79]">Points:</span>
                    <span className="text-sm font-bold text-[#082051]">
                      {ev.rawScore} / {ev.maxScore}
                    </span>
                  </div>
                </div>

                {/* Stimulus / Passage if any */}
                {q.passage && (
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-[#082051] whitespace-pre-wrap leading-relaxed">
                    <span className="font-bold text-[#0967F7] block mb-1">Passage:</span>
                    {q.passage}
                  </div>
                )}

                {/* Prompt */}
                <div className="text-sm font-semibold text-[#082051]">
                  {q.prompt}
                </div>

                {/* Question Body & Student Response */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: Student Answer */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
                      Learner Response
                    </div>

                    {q.type === 'MCQ' && (
                      <div className="space-y-2">
                        {q.options?.map((opt: any, optIdx: number) => {
                          const optionText = typeof opt === 'string' ? opt : opt.text || opt.label;
                          const isStudentSelected =
                            r.responsePayload === optionText ||
                            r.responsePayload === optIdx ||
                            r.responsePayload?.selectedOption === optionText ||
                            r.responsePayload?.selectedOption === optIdx;
                          const isCorrectOpt =
                            q.correctAnswer === optionText ||
                            q.correctAnswer === optIdx ||
                            (typeof q.correctAnswer === 'object' && q.correctAnswer?.text === optionText);

                          let borderClass = 'border-gray-200 bg-white';
                          if (isStudentSelected && isCorrectOpt) {
                            borderClass = 'border-emerald-500 bg-emerald-50/60 text-emerald-900';
                          } else if (isStudentSelected && !isCorrectOpt) {
                            borderClass = 'border-red-400 bg-red-50/60 text-red-900';
                          } else if (isCorrectOpt) {
                            borderClass = 'border-emerald-300 bg-emerald-50/20 text-emerald-800';
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${borderClass}`}
                            >
                              <span>{optionText}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isStudentSelected && (
                                  <Badge variant={isCorrectOpt ? 'success' : 'danger'}>
                                    Selected
                                  </Badge>
                                )}
                                {isCorrectOpt && (
                                  <Badge variant="success">Correct Answer</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'SHORT_ANSWER' && (
                      <div className="space-y-2">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-[#082051] whitespace-pre-wrap font-sans">
                          {typeof r.responsePayload === 'string'
                            ? r.responsePayload
                            : r.responsePayload?.text || 'No response provided.'}
                        </div>
                        {q.correctAnswer && (
                          <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                            <span className="font-bold">Target Answer / Keywords: </span>
                            {typeof q.correctAnswer === 'string'
                              ? q.correctAnswer
                              : JSON.stringify(q.correctAnswer)}
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === 'WRITING' && (
                      <div className="space-y-2">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-[#082051] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-sans">
                          {typeof r.responsePayload === 'string'
                            ? r.responsePayload
                            : r.responsePayload?.text || 'No text submitted.'}
                        </div>
                        {typeof r.responsePayload === 'string' && (
                          <div className="text-[11px] text-[#656C79]">
                            Word count:{' '}
                            {r.responsePayload.trim().split(/\s+/).filter(Boolean).length} words
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === 'SPEAKING' && (
                      <div className="space-y-3">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#082051]">
                            <Mic className="w-4 h-4 text-[#0967F7]" />
                            <span>Audio Recording</span>
                          </div>

                          {audioLoading[qId] ? (
                            <div className="text-xs text-[#656C79]">Loading audio stream...</div>
                          ) : audioUrl ? (
                            <audio controls src={audioUrl} className="w-full h-10" />
                          ) : (
                            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                              No audio stream recording found for this response.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Scoring & Rubrics */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
                      Grading & Feedback
                    </div>

                    {/* Rubric evaluation for Writing / Speaking */}
                    {(q.type === 'WRITING' || q.type === 'SPEAKING') ? (
                      <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        {(() => {
                          let currentRubric: any[] = [];
                          if (q.rubric) {
                            try {
                              currentRubric = typeof q.rubric === 'string' ? JSON.parse(q.rubric) : q.rubric;
                            } catch (e) {}
                          }
                          if (!Array.isArray(currentRubric)) currentRubric = [];
                          return currentRubric.map((dim) => {
                            const val = ev.rubricScores?.[dim.criteria] ?? dim.maxScore;
                            return (
                              <div key={dim.criteria} className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span>{dim.criteria}</span>
                                  <span className="text-[#0967F7]">{val} / {dim.maxScore}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max={dim.maxScore}
                                  value={val}
                                  onChange={(e) =>
                                    updateRubricScore(
                                      qId,
                                      dim.criteria,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full accent-[#0967F7]"
                                />
                              </div>
                            );
                          });
                        })()}

                        <div className="pt-2 flex justify-between items-center text-xs font-bold border-t border-gray-200">
                          <span>Calculated Raw Score:</span>
                          <span className="text-sm text-[#0967F7]">
                            {ev.rawScore} / {ev.maxScore}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Score input for MCQ / Short answer */
                      <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                          <Input
                            label="Score"
                            type="number"
                            min="0"
                            max={ev.maxScore}
                            value={ev.rawScore}
                            onChange={(e) => updateRawScore(qId, Number(e.target.value))}
                            className="w-24 text-xs"
                          />
                          <span className="text-xs text-[#656C79] pt-6">/ {ev.maxScore} points</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-[#082051] flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ev.isCorrect ?? false}
                              onChange={(e) =>
                                setEvaluations((prev) => ({
                                  ...prev,
                                  [qId]: {
                                    ...prev[qId],
                                    isCorrect: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded accent-[#0967F7]"
                            />
                            Mark as Correct
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Question Specific Feedback */}
                    <Textarea
                      label="Question Feedback"
                      value={ev.teacherFeedback || ''}
                      onChange={(e) => updateFeedback(qId, e.target.value)}
                      placeholder="Feedback for this specific question..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
