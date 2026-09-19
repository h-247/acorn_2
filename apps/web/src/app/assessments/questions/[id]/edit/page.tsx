'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Card,
  Input,
  Textarea,
  Select,
} from '@acorn/ui';
import { Check, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function QuestionEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === 'new';

  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState('MCQ');
  const [level, setLevel] = useState('B1');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [options, setOptions] = useState<string[]>([
    'A. Option 1',
    'B. Option 2',
    'C. Option 3',
    'D. Option 4',
  ]);
  const [correctAnswer, setCorrectAnswer] = useState('B. Option 2');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api.getQuestion(params.id).then((q) => {
        setPrompt(q.prompt);
        setType(q.type);
        setLevel(q.level);
        setDifficulty(q.difficulty);
        if (q.options) setOptions(q.options);
        if (q.correctAnswer) setCorrectAnswer(q.correctAnswer);
      }).catch(() => {});
    }
  }, [params.id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createQuestion({
        type,
        prompt,
        options,
        correctAnswer,
        difficulty,
        level,
        skills: [
          { skillId: '66666666-6666-6666-6666-666666666604', skillName: 'Reading • Inference', role: 'PRIMARY', weight: 1.5 },
        ],
      });
      router.push('/assessments/questions');
    } catch (err) {
      alert('Failed to save question');
      setSaving(false);
    }
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 border-gray-200/80 space-y-4">
              <Textarea
                label="Question Prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="According to the passage, what can be inferred..."
                rows={3}
                required
              />

              {type === 'MCQ' && (
                <div className="space-y-2">
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
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Configuration</h3>

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
                label="Level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                options={[
                  { label: 'A2', value: 'A2' },
                  { label: 'B1', value: 'B1' },
                  { label: 'B2', value: 'B2' },
                ]}
              />
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
