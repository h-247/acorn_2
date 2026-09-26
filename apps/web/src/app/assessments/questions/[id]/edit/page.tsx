'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Card,
  Input,
  Textarea,
  Select,
  ErrorState,
} from '@acorn/ui';
import { Check, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function QuestionEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === 'new';

  const [prompt, setPrompt] = useState('');
  const [passage, setPassage] = useState('');
  const [type, setType] = useState('MCQ');
  const [level, setLevel] = useState('B1');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [topic, setTopic] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [status, setStatus] = useState('APPROVED');
  const [usageCount, setUsageCount] = useState(0);
  // Which material this question was written from. The column and the
  // contract both had room for it; only the form never asked, so a question
  // authored by hand broke the Material -> Question -> Evidence chain that
  // the evidence drill-down and the learner journey are read from.
  const [sourceMaterialId, setSourceMaterialId] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);

  // MCQ specific
  const [options, setOptions] = useState<string[]>([
    'A. Option 1',
    'B. Option 2',
    'C. Option 3',
    'D. Option 4',
  ]);
  const [correctAnswer, setCorrectAnswer] = useState('B. Option 2');
  const [explanation, setExplanation] = useState('');

  // Short answer specific
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [keyPhrases, setKeyPhrases] = useState('');

  // Writing & Speaking specific
  const [wordCountMin, setWordCountMin] = useState(150);
  const [wordCountMax, setWordCountMax] = useState(250);
  const [prepTimeSeconds, setPrepTimeSeconds] = useState(60);
  const [durationSeconds, setDurationSeconds] = useState(120);
  const [rubricCriteria, setRubricCriteria] = useState(
    JSON.stringify([
      { criteria: 'Task Achievement', maxScore: 25 },
      { criteria: 'Coherence & Cohesion', maxScore: 25 },
      { criteria: 'Lexical Resource', maxScore: 25 },
      { criteria: 'Grammatical Accuracy', maxScore: 25 }
    ], null, 2)
  );

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('66666666-6666-6666-6666-666666666604');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(!isNew);
    setErrorMessage(null);
    try {
      const skillsPromise = api.getSkills();
      const materialsPromise = api.getMaterials().catch(() => []);
      const questionPromise = !isNew ? api.getQuestion(params.id) : Promise.resolve(null);

      const [skills, mats, q] = await Promise.all([
        skillsPromise,
        materialsPromise,
        questionPromise,
      ]);

      setAvailableSkills(skills || []);
      setMaterials(Array.isArray(mats) ? mats : (mats as any)?.items || []);
      if (skills && skills.length > 0) {
        setSelectedSkillId((prev) => prev || skills[0].id);
      }

      if (q) {
        setPrompt(q.prompt || '');
        setPassage(q.passage || '');
        setType(q.type || 'MCQ');
        setLevel(q.level || 'B1');
        setDifficulty(q.difficulty || 'MEDIUM');
        setTopic(q.topic || '');
        setStatus(q.status || 'APPROVED');
        setUsageCount(q.usageCount || 0);
        if (q.estimatedMinutes) setEstimatedMinutes(q.estimatedMinutes);
        if (q.options) setOptions(q.options);
        if (q.correctAnswer) setCorrectAnswer(q.correctAnswer);
        if (q.explanation) setExplanation(q.explanation);
        setSourceMaterialId(q.sourceMaterialId || '');
        if (q.rubric) {
          if (typeof q.rubric === 'string') setRubricCriteria(q.rubric);
          else setRubricCriteria(JSON.stringify(q.rubric, null, 2));
        }
        if (q.skills && q.skills.length > 0) {
          setSelectedSkillId(q.skills[0].skillId);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load question details');
    } finally {
      setLoading(false);
    }
  }, [params.id, isNew]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    try {
      const selectedSkill = availableSkills.find((s) => s.id === selectedSkillId);
      const skillPayload = [
        {
          skillId: selectedSkillId,
          skillName: selectedSkill?.name || 'Reading • Inference',
          role: 'PRIMARY' as const,
          weight: 1.0,
        },
      ];

      let parsedRubric;
      if (type === 'WRITING' || type === 'SPEAKING') {
        try {
          parsedRubric = JSON.parse(rubricCriteria);
        } catch (e) {
          throw new Error('Rubric criteria must be a valid JSON array');
        }
      }

      const payload: any = {
        sourceMaterialId: sourceMaterialId || undefined,
        type,
        prompt,
        passage: passage || undefined,
        difficulty,
        level,
        status,
        skills: skillPayload,
        options: type === 'MCQ' ? options : undefined,
        correctAnswer: type === 'MCQ' ? correctAnswer : undefined,
        rubric: parsedRubric,
      };

      if (isNew) {
        await api.createQuestion(payload);
      } else {
        await api.updateQuestion(params.id, payload);
      }
      router.push('/assessments/questions');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save question item');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/assessments" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading question...</div>
      </AppShell>
    );
  }

  if (!isNew && errorMessage && !prompt) {
    return (
      <AppShell currentPath="/assessments" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load question"
            message={errorMessage}
            onRetry={loadData}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <form onSubmit={handleSubmit} className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Assessments', href: '/assessments' },
            { label: 'Question Bank', href: '/assessments/questions' },
            { label: isNew ? 'Create Question' : 'Edit Question' },
          ]}
          title={isNew ? 'Question Editor' : 'Edit Question Item'}
          subtitle="Author or review reusable skill-mapped English assessment items."
          actions={
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              icon={<Check className="w-4 h-4" />}
            >
              Save to Question Bank
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 border-gray-200/80 space-y-4">
              <Input
                label="Topic / Subject"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Science, Urban Farming, IELTS Speaking Part 2"
              />

              <Textarea
                label="Question Prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="According to the passage, what can be inferred..."
                rows={3}
                required
              />

              <Textarea
                label="Stimulus Text / Passage / Context (Optional)"
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Optional background reading passage, transcript, or speaking prompt scenario..."
                rows={5}
              />

              {/* 1. MCQ Options & Explanation */}
              {type === 'MCQ' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <label className="text-sm font-medium text-[#082051]">Options & Answers</label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={correctAnswer === opt}
                        onChange={() => setCorrectAnswer(opt)}
                        className="text-[#0967F7]"
                      />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[i] = e.target.value;
                          setOptions(newOpts);
                        }}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-[#656C79]">
                    Select the radio button next to the option that represents the correct answer key.
                  </p>

                  <Textarea
                    label="Pedagogical Explanation / Answer Key Rationale"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Explanation of why this answer is correct based on the text..."
                    rows={2}
                  />
                </div>
              )}

              {/* 2. Short Answer Settings */}
              {type === 'SHORT_ANSWER' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Textarea
                    label="Sample Exemplar Answer"
                    value={sampleAnswer}
                    onChange={(e) => setSampleAnswer(e.target.value)}
                    placeholder="Provide a reference model response..."
                    rows={2}
                  />
                  <Input
                    label="Key Matching Phrases (comma-separated)"
                    value={keyPhrases}
                    onChange={(e) => setKeyPhrases(e.target.value)}
                    placeholder="e.g. sustainable, vertical farming, initial costs"
                  />
                </div>
              )}

              {/* 3. Writing Task Settings */}
              {type === 'WRITING' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Minimum Word Count"
                      type="number"
                      value={wordCountMin}
                      onChange={(e) => setWordCountMin(Number(e.target.value))}
                    />
                    <Input
                      label="Maximum Word Count"
                      type="number"
                      value={wordCountMax}
                      onChange={(e) => setWordCountMax(Number(e.target.value))}
                    />
                  </div>
                  <Textarea
                    label="Evaluation Rubric Criteria"
                    value={rubricCriteria}
                    onChange={(e) => setRubricCriteria(e.target.value)}
                    placeholder="Specify criteria: Task Response, Coherence, Vocabulary, Grammar..."
                    rows={3}
                  />
                </div>
              )}

              {/* 4. Speaking Task Settings */}
              {type === 'SPEAKING' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Preparation Time (seconds)"
                      type="number"
                      value={prepTimeSeconds}
                      onChange={(e) => setPrepTimeSeconds(Number(e.target.value))}
                    />
                    <Input
                      label="Recording Limit (seconds)"
                      type="number"
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    />
                  </div>
                  <Textarea
                    label="Speaking Rubric Criteria"
                    value={rubricCriteria}
                    onChange={(e) => setRubricCriteria(e.target.value)}
                    placeholder="Fluency & Coherence, Lexical Resource, Pronunciation, Grammar..."
                    rows={3}
                  />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Configuration</h3>

              <Select
                label="Source Material (optional)"
                value={sourceMaterialId}
                onChange={(e) => setSourceMaterialId(e.target.value)}
                options={[
                  { label: '— Not from a material —', value: '' },
                  ...materials.map((m: any) => ({ label: m.title, value: m.id })),
                ]}
              />

              <Select
                label="Primary Skill"
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                options={
                  availableSkills.length > 0
                    ? availableSkills.map((s) => ({ label: `${s.area} • ${s.name}`, value: s.id }))
                    : [{ label: 'Reading • Inference', value: '66666666-6666-6666-6666-666666666604' }]
                }
              />

              <Select
                label="Item Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                options={[
                  { label: 'Multiple Choice (MCQ)', value: 'MCQ' },
                  { label: 'Short Answer', value: 'SHORT_ANSWER' },
                  { label: 'Writing Task', value: 'WRITING' },
                  { label: 'Speaking Task', value: 'SPEAKING' },
                ]}
              />

              <Select
                label="Difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                options={[
                  { label: 'Easy', value: 'EASY' },
                  { label: 'Medium', value: 'MEDIUM' },
                  { label: 'Hard', value: 'HARD' },
                ]}
              />

              <Select
                label="Target CEFR Level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                options={[
                  { label: 'A1 Beginner', value: 'A1' },
                  { label: 'A2 Elementary', value: 'A2' },
                  { label: 'B1 Intermediate', value: 'B1' },
                  { label: 'B2 Upper Intermediate', value: 'B2' },
                  { label: 'C1 Advanced', value: 'C1' },
                  { label: 'C2 Mastery', value: 'C2' },
                ]}
              />

              <Select
                label="Status Lifecycle"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'In Review', value: 'IN_REVIEW' },
                  { label: 'Approved', value: 'APPROVED' },
                  { label: 'Retired', value: 'RETIRED' },
                ]}
              />

              <Input
                label="Estimated Duration (minutes)"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />

              {!isNew && (
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                  <span className="text-[#656C79]">Bank Usage:</span>
                  <span className="font-bold text-[#0967F7]">
                    Included in {usageCount} assessment{usageCount === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
