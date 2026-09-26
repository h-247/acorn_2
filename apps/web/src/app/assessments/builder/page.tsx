'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Badge,
  ErrorState,
  Dialog,
} from '@acorn/ui';
import { Check, Plus, Trash2, Clock, CheckSquare, AlertCircle, Eye, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentBuilderPage() {
  const router = useRouter();
  // `?draftId=…` reopens an existing draft. Without it the page behaves as it
  // always has and creates a new assessment.
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const [title, setTitle] = useState('IELTS Reading Checkpoint 04');
  const [description, setDescription] = useState('Checkpoint covering main idea, detail lookup, and inference skills.');
  const [instructions, setInstructions] = useState('Read the passage carefully and answer each question. You may review answers before final submission.');
  const [level, setLevel] = useState('B1');
  const [timeLimit, setTimeLimit] = useState(20);
  const [initialStatus, setInitialStatus] = useState('PUBLISHED');
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Only for questions without a rubric; a rubric carries its own total.
  const [itemPoints, setItemPoints] = useState<Record<string, number>>({});
  const [loadingDraft, setLoadingDraft] = useState(false);

  // Question search & filter
  const [bankSearch, setBankSearch] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState('ALL');
  const [bankLevelFilter, setBankLevelFilter] = useState('ALL');
  const [bankDiffFilter, setBankDiffFilter] = useState('ALL');

  const [saving, setSaving] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setErrorMessage(null);
    try {
      const qs = await api.getQuestions();
      setQuestions(qs || []);
      if (qs && qs.length > 0) {
        setSelectedQIds(qs.slice(0, 3).map((q) => q.id));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load question bank items');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Reopen a draft. The backend refuses edits to anything past DRAFT, so a
  // published paper cannot be reshaped underneath the learners sitting it.
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;

    (async () => {
      setLoadingDraft(true);
      setErrorMessage(null);
      try {
        const a = await api.getAssessment(draftId);
        if (cancelled) return;

        if (a.status && a.status !== 'DRAFT') {
          setErrorMessage(
            `This assessment is ${a.status} and can no longer be edited. Create a new one instead.`
          );
          return;
        }

        setTitle(a.title || '');
        setDescription(a.description || '');
        setInstructions(a.instructions || '');
        setLevel(a.level || 'B1');
        setTimeLimit(a.timeLimitMinutes || 20);
        setInitialStatus('DRAFT');

        const items = a.items || a.questions || [];
        setSelectedQIds(items.map((it: any) => it.questionId || it.question?.id).filter(Boolean));
        setItemPoints(
          Object.fromEntries(
            items
              .filter((it: any) => it.points != null)
              .map((it: any) => [it.questionId || it.question?.id, Number(it.points)])
          )
        );
      } catch (err: any) {
        if (!cancelled) setErrorMessage(err.message || 'Failed to load the draft');
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const toggleQuestion = (id: string) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter((qId) => qId !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const moveQuestion = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= selectedQIds.length) return;
    const reordered = [...selectedQIds];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setSelectedQIds(reordered);
  };

  const handleCreate = async () => {
    if (selectedQIds.length === 0) {
      setErrorMessage('Please select at least 1 question for the assessment.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = {
        title,
        description,
        instructions: instructions || undefined,
        level,
        timeLimitMinutes: Number(timeLimit),
        questionIds: selectedQIds,
        itemPoints,
      };

      const res = draftId
        ? await api.updateAssessment(draftId, payload)
        : await api.createAssessment(payload);

      if (initialStatus === 'PUBLISHED') {
        // Swallowing this left the teacher on the assessment page believing it
        // was published when it was still a draft - and nothing on that page
        // says otherwise loudly enough to catch.
        try {
          await api.publishAssessment(res.id);
        } catch (publishErr: any) {
          setErrorMessage(
            `Assessment saved as a draft, but publishing failed: ${
              publishErr?.message || 'unknown error'
            }`
          );
          setSaving(false);
          return;
        }
      }

      router.push(`/assessments/${res.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create assessment');
      setSaving(false);
    }
  };

  // Filtered bank questions
  const filteredBankQuestions = questions.filter((q) => {
    if (bankSearch.trim()) {
      const term = bankSearch.toLowerCase();
      if (!q.prompt?.toLowerCase().includes(term) && !q.topic?.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (bankTypeFilter !== 'ALL' && q.type !== bankTypeFilter) return false;
    if (bankLevelFilter !== 'ALL' && q.level !== bankLevelFilter) return false;
    if (bankDiffFilter !== 'ALL' && q.difficulty !== bankDiffFilter) return false;
    return true;
  });

  const selectedQuestionsList = selectedQIds
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean);

  /**
   * What one question is worth on this paper.
   *
   * A rubric decides its own total - the marking screen checks the two agree -
   * so only questions without one are the teacher's to weight.
   */
  const rubricTotal = (q: any): number | null => {
    if (!q?.rubric) return null;
    try {
      const parsed = typeof q.rubric === 'string' ? JSON.parse(q.rubric) : q.rubric;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return parsed.reduce((sum: number, c: any) => sum + (c.maxScore || 0), 0);
    } catch {
      return null;
    }
  };

  const pointsFor = (q: any): number => rubricTotal(q) ?? itemPoints[q.id] ?? 1;

  const totalPoints = selectedQuestionsList.reduce(
    (sum: number, q: any) => sum + pointsFor(q),
    0
  );

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Assessments', href: '/assessments' },
            { label: 'Assessment Builder' },
          ]}
          title="Assessment Builder"
          subtitle="Assemble, balance, and publish skill checkpoints using reusable question items."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsPreviewOpen(true)}
                icon={<Eye className="w-4 h-4 text-[#0967F7]" />}
                disabled={selectedQuestionsList.length === 0}
              >
                Preview as Student
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={saving}
                onClick={handleCreate}
                icon={<Check className="w-4 h-4" />}
              >
                {initialStatus === 'PUBLISHED' ? 'Publish Assessment' : 'Save Draft'}
              </Button>
            </div>
          }
        />

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-700 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {questions.length === 0 && (
              <Button variant="outline" size="sm" onClick={loadQuestions} className="text-red-700 border-red-300">
                Retry Questions
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Assessment Composition */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Assessment Properties</h3>
              <Input
                label="Assessment Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                label="Description & Focus"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <Textarea
                label="Student Instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="Explicit instructions displayed to students when opening the checkpoint..."
              />
            </Card>

            {/* Selected Questions in this Assessment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#082051]">
                  Composed Items ({selectedQuestionsList.length})
                </h3>
                <span className="text-xs text-[#656C79]">
                  Total points: <strong className="text-[#0967F7]">{totalPoints} pts</strong>
                </span>
              </div>

              {selectedQuestionsList.length > 0 ? (
                selectedQuestionsList.map((q: any, index: number) => (
                  <div
                    key={q.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#F3F6FC] text-[#0967F7] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#082051] mb-1">{q.prompt}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="primary">{q.type}</Badge>
                          <Badge variant="default">{q.difficulty}</Badge>
                          <Badge variant="warning">{q.level}</Badge>
                          {rubricTotal(q) != null ? (
                            <span className="text-xs text-[#5969AB]">
                              {rubricTotal(q)} pts from rubric
                            </span>
                          ) : (
                            <label className="flex items-center gap-1.5 text-xs text-[#5969AB]">
                              <span>Points</span>
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                value={itemPoints[q.id] ?? 1}
                                onChange={(e) =>
                                  setItemPoints((prev) => ({
                                    ...prev,
                                    [q.id]: Math.max(1, Number(e.target.value) || 1),
                                  }))
                                }
                                className="w-14 px-1.5 py-0.5 border border-gray-200 rounded-md text-xs"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 1)}
                        disabled={index === selectedQuestionsList.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleQuestion(q.id)}
                        className="text-red-500 hover:text-red-700 p-1 ml-1 rounded"
                        title="Remove question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Card className="p-8 text-center text-xs text-[#656C79] border-dashed">
                  No questions selected yet. Choose items from the question bank on the right to compose this assessment.
                </Card>
              )}
            </div>
          </div>

          {/* Configuration & Question Selector Sidebar */}
          <div className="space-y-5">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Configuration & Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="CEFR Target"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  options={[
                    { label: 'A1 Beginner', value: 'A1' },
                    { label: 'A2 Elementary', value: 'A2' },
                    { label: 'B1 Intermediate', value: 'B1' },
                    { label: 'B2 Upper Intermediate', value: 'B2' },
                    { label: 'C1 Advanced', value: 'C1' },
                  ]}
                />
                <Select
                  label="Publish Status"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value)}
                  options={[
                    { label: 'Ready / Publish', value: 'PUBLISHED' },
                    { label: 'Draft', value: 'DRAFT' },
                  ]}
                />
              </div>

              <Input
                label="Time Limit (mins)"
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs flex justify-between">
                <span className="text-[#656C79]">Calculated Total:</span>
                <span className="font-bold text-[#0967F7]">
                  {selectedQuestionsList.length} questions / {totalPoints} pts
                </span>
              </div>
            </Card>

            {/* Question Selector Sidebar with Search & Filter */}
            <Card className="p-5 border-gray-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#082051]">Question Bank</h3>
                <a href="/assessments/questions/new/edit" className="text-xs text-[#0967F7] hover:underline font-semibold">
                  + New Item
                </a>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search bank items..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F3F6FC] rounded-lg text-xs border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <select
                    value={bankTypeFilter}
                    onChange={(e) => setBankTypeFilter(e.target.value)}
                    className="p-1 bg-[#F3F6FC] rounded text-[11px] border border-gray-200"
                  >
                    <option value="ALL">All Types</option>
                    <option value="MCQ">MCQ</option>
                    <option value="SHORT_ANSWER">Short Ans</option>
                    <option value="WRITING">Writing</option>
                    <option value="SPEAKING">Speaking</option>
                  </select>

                  <select
                    value={bankLevelFilter}
                    onChange={(e) => setBankLevelFilter(e.target.value)}
                    className="p-1 bg-[#F3F6FC] rounded text-[11px] border border-gray-200"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                  </select>

                  <select
                    value={bankDiffFilter}
                    onChange={(e) => setBankDiffFilter(e.target.value)}
                    className="p-1 bg-[#F3F6FC] rounded text-[11px] border border-gray-200"
                  >
                    <option value="ALL">All Diff</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              {loadingQuestions ? (
                <div className="p-6 text-center text-xs text-[#656C79]">Loading question bank...</div>
              ) : filteredBankQuestions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#656C79] border border-dashed border-gray-200 rounded-xl">
                  <p className="mb-2">No matching questions found.</p>
                  <Button variant="outline" size="sm" onClick={loadQuestions}>
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredBankQuestions.map((q) => {
                    const isSelected = selectedQIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQuestion(q.id)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-[#0967F7] text-[#0967F7] font-semibold'
                            : 'bg-white border-gray-200 text-[#082051] hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] uppercase font-bold">{q.type} • {q.level}</span>
                          <span>{isSelected ? '✓ Added' : '+ Add'}</span>
                        </div>
                        <p className="line-clamp-2 text-[11px]">{q.prompt}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* DIALOG: STUDENT PREVIEW MODAL */}
        <Dialog
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title={`Student View Preview — ${title}`}
        >
          <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-[#082051]">Time Allowed: {timeLimit} minutes</span>
                <span className="text-[11px] text-[#656C79] block">
                  {selectedQuestionsList.length} questions • {totalPoints} pts
                </span>
              </div>
              <Badge variant="primary">{level}</Badge>
            </div>

            {instructions && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[#656C79]">
                <strong className="text-[#082051] block mb-1">Instructions:</strong>
                {instructions}
              </div>
            )}

            <div className="space-y-4">
              {selectedQuestionsList.map((q: any, i: number) => (
                <div key={q.id} className="p-4 bg-white rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-[#082051]">
                    <span>Question {i + 1} ({q.type})</span>
                    <span className="text-[11px] text-[#5969AB]">1 pt</span>
                  </div>
                  <p className="font-medium text-[#082051]">{q.prompt}</p>

                  {q.passage && (
                    <div className="p-2.5 bg-gray-50 rounded-lg text-[11px] text-[#656C79] font-serif border border-gray-100">
                      {q.passage}
                    </div>
                  )}

                  {q.type === 'MCQ' && q.options && (
                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt: string, optIdx: number) => (
                        <div key={optIdx} className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'WRITING' && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center text-[#656C79]">
                      [Student Essay / Writing Response Box]
                    </div>
                  )}

                  {q.type === 'SPEAKING' && (
                    <div className="p-4 bg-blue-50/40 rounded-lg border border-blue-200 text-center text-[#0967F7]">
                      🎙️ [Student Speaking Audio Recorder & Player Preview]
                    </div>
                  )}

                  {q.type === 'SHORT_ANSWER' && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-[#656C79]">
                      [Student Short Answer Text Area]
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setIsPreviewOpen(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
