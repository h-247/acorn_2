'use client';

import React, { useState, useEffect } from 'react';
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
} from '@acorn/ui';
import { Check, Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [submission, setSubmission] = useState<any | null>(null);
  const [feedback, setFeedback] = useState('Well done, Emma! You present clear ideas and good examples, especially about transport and air quality.');
  const [taskScore, setTaskScore] = useState(18);
  const [coherenceScore, setCoherenceScore] = useState(17);
  const [vocabScore, setVocabScore] = useState(18);
  const [grammarScore, setGrammarScore] = useState(19);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSubmission(params.id).then(setSubmission).catch(() => {});
  }, [params.id]);

  const totalScore = taskScore + coherenceScore + vocabScore + grammarScore;

  const handleFinalize = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      await api.evaluate(submission.id, {
        submissionId: submission.id,
        responses: [
          {
            questionId: '88888888-8888-8888-8888-888888888805',
            rawScore: totalScore,
            maxScore: 100,
            rubricScores: {
              taskAchievement: taskScore,
              coherence: coherenceScore,
              vocabulary: vocabScore,
              grammar: grammarScore,
            },
            teacherFeedback: feedback,
          },
        ],
        overallTeacherFeedback: feedback,
      });
      alert('Evaluation finalized! Learning evidence and learner skill state have been updated.');
      router.push('/submissions');
    } catch (err) {
      alert('Failed to finalize evaluation');
      setSaving(false);
    }
  };

  if (!submission) {
    return (
      <AppShell currentPath="/submissions">
        <div className="p-8 text-center text-[#656C79]">Loading submission review...</div>
      </AppShell>
    );
  }

  const sampleEssay = `Urban farming can be a good solution to some of the environmental problems in cities. I mostly agree with this idea because it brings many benefits, although it cannot solve all the problems.

First, urban farming helps to reduce the distance that food needs to travel. This means less transport, so there are fewer carbon emissions. For example, if vegetables are grown on rooftops or in community gardens, they can be sold locally and stay fresh. Second, urban farming can improve air quality and make cities greener. Plants absorb carbon dioxide and create cleaner air, and green spaces also make people feel happier.

However, urban farming alone is not enough. The amount of food produced in cities is still small compared to the total demand. It can also be expensive and difficult to maintain, especially in high-rise buildings. Therefore, it should be part of a bigger plan that includes other solutions, such as reducing food waste and using renewable energy.

In conclusion, I believe urban farming is a positive step towards more sustainable cities, but it is not a complete solution. It can help, especially with local food supply and public awareness.`;

  return (
    <AppShell currentPath="/submissions" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Submissions', href: '/submissions' },
            { label: 'Review' },
          ]}
          title="Submission Review"
          subtitle="Review learner submissions, evaluate with a rubric, and provide feedback."
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

        {/* Top Summary Strip */}
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-[#656C79]">Assessment</span>
            <div className="text-sm font-bold text-[#082051]">{submission.assessmentTitle}</div>
            <span className="text-[11px] text-[#5969AB]">Due Mar 12, 2025 • Class: IELTS Foundation A</span>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[#656C79]">Learner</span>
              <div className="text-sm font-bold text-[#082051]">{submission.learnerName}</div>
            </div>
            <div>
              <span className="text-xs text-[#656C79]">Score</span>
              <div className="text-lg font-bold text-[#0967F7]">{totalScore} / 100</div>
            </div>
          </div>
        </div>

        {/* Split Grid: Student Submission vs Rubric Scoring */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Student Submission */}
          <Card className="p-6 border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
                Student Submission (198 words)
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                On time
              </span>
            </div>
            <div className="prose text-xs text-[#082051] leading-relaxed whitespace-pre-wrap max-h-[480px] overflow-y-auto bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              {sampleEssay}
            </div>
          </Card>

          {/* Right: Rubric Evaluation */}
          <div className="space-y-4">
            <Card className="p-6 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Rubric Assessment</h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Task Achievement</span>
                    <span className="text-[#0967F7]">{taskScore} / 25</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={taskScore}
                    onChange={(e) => setTaskScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Coherence & Cohesion</span>
                    <span className="text-[#0967F7]">{coherenceScore} / 25</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={coherenceScore}
                    onChange={(e) => setCoherenceScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Vocabulary</span>
                    <span className="text-[#0967F7]">{vocabScore} / 25</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={vocabScore}
                    onChange={(e) => setVocabScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Grammar Accuracy</span>
                    <span className="text-[#0967F7]">{grammarScore} / 25</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={grammarScore}
                    onChange={(e) => setGrammarScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <Textarea
                  label="Teacher Feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="pt-2 text-xs text-[#656C79]">
                <span className="font-semibold text-[#082051]">Contributes to:</span> Writing, Vocabulary, Grammar, Critical thinking.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
