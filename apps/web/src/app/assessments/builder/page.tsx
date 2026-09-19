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
  Badge,
} from '@acorn/ui';
import { Check, Plus, Trash2, Clock, CheckSquare } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentBuilderPage() {
  const router = useRouter();
  const [title, setTitle] = useState('IELTS Reading Checkpoint 04');
  const [description, setDescription] = useState('Checkpoint covering main idea, detail lookup, and inference skills.');
  const [level, setLevel] = useState('B1');
  const [timeLimit, setTimeLimit] = useState(20);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getQuestions().then((qs) => {
      setQuestions(qs);
      if (qs.length > 0) {
        setSelectedQIds(qs.slice(0, 3).map((q) => q.id));
      }
    }).catch(() => {});
  }, []);

  const toggleQuestion = (id: string) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter((qId) => qId !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const handleCreate = async () => {
    if (selectedQIds.length === 0) {
      alert('Please select at least 1 question');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createAssessment({
        title,
        description,
        level,
        timeLimitMinutes: Number(timeLimit),
        questionIds: selectedQIds,
      });
      router.push(`/assessments/${res.id}`);
    } catch (err) {
      alert('Failed to create assessment');
      setSaving(false);
    }
  };

  const selectedQuestionsList = questions.filter((q) => selectedQIds.includes(q.id));

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
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={handleCreate}
              icon={<Check className="w-4 h-4" />}
            >
              Publish Assessment
            </Button>
          }
        />

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
                label="Instructions / Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </Card>

            {/* Selected Questions in this Assessment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#082051]">
                  Composed Items ({selectedQuestionsList.length})
                </h3>
                <span className="text-xs text-[#656C79]">
                  Total points: {selectedQuestionsList.length} pts
                </span>
              </div>

              {selectedQuestionsList.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F3F6FC] text-[#0967F7] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#082051] mb-1">{q.prompt}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="primary">{q.type}</Badge>
                        <Badge variant="default">{q.difficulty}</Badge>
                        <span className="text-xs text-[#5969AB]">1 point</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Question Selector Sidebar */}
          <div className="space-y-5">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Configuration</h3>
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
              <Input
                label="Time Limit (minutes)"
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />
            </Card>

            <Card className="p-5 border-gray-200/80 space-y-3">
              <h3 className="text-sm font-bold text-[#082051]">Add from Question Bank</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {questions.map((q) => {
                  const isSelected = selectedQIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleQuestion(q.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-[#0967F7] text-[#0967F7] font-semibold'
                          : 'bg-white border-gray-200 text-[#082051] hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px]">{q.type}</span>
                        <span>{isSelected ? '✓ Added' : '+ Add'}</span>
                      </div>
                      <p className="line-clamp-2">{q.prompt}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
