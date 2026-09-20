'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  SearchFilterBar,
  Button,
  Badge,
  Card,
  Drawer,
  ErrorState,
  EmptyState,
} from '@acorn/ui';
import { Plus, CheckSquare, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQ, setSelectedQ] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getQuestions(search ? `query=${encodeURIComponent(search)}` : '');
      setQuestions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load questions from bank');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Question Bank</h1>
            <p className="text-sm text-[#656C79] mt-1">
              Reusable skill-mapped English assessment items with explicit answer keys and rubrics.
            </p>
          </div>
          <a href="/assessments/questions/new/edit">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              Create Question
            </Button>
          </a>
        </div>

        <SearchFilterBar
          searchPlaceholder="Search question prompt or passage..."
          searchValue={search}
          onSearchChange={setSearch}
        />

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading questions...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load questions"
              message={error}
              onRetry={loadQuestions}
            />
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            title="No questions found"
            description={
              search
                ? 'No questions matched your search query.'
                : 'Your question bank is empty. Author reusable items to assemble into assessments.'
            }
            action={
              <a href="/assessments/questions/new/edit">
                <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
                  Create Question
                </Button>
              </a>
            }
          />
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Card
                key={q.id}
                hoverable
                onClick={() => setSelectedQ(q)}
                className="p-4 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="primary">{q.type}</Badge>
                    <Badge variant="default">{q.level}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      q.difficulty === 'HARD' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {q.difficulty}
                    </span>
                    {q.sourceMaterialTitle && (
                      <span className="text-xs text-[#5969AB]">
                        Source: {q.sourceMaterialTitle}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[#082051] line-clamp-2">{q.prompt}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {q.skills?.map((s: any) => (
                      <span key={s.skillId} className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2 py-0.5 rounded font-medium">
                        {s.skillName} ({s.weight}x)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#656C79]">{q.usageCount || 0} tests</span>
                  <span className="text-gray-400 text-sm">›</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Inspection Drawer */}
        <Drawer
          isOpen={!!selectedQ}
          onClose={() => setSelectedQ(null)}
          title="Question Item Detail"
        >
          {selectedQ && (
            <div className="space-y-5 text-[#082051]">
              <div className="flex items-center gap-2">
                <Badge variant="primary">{selectedQ.type}</Badge>
                <Badge variant="default">{selectedQ.level}</Badge>
                <Badge variant="warning">{selectedQ.difficulty}</Badge>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#656C79] uppercase tracking-wider mb-1">
                  Prompt
                </h4>
                <div className="bg-[#F3F6FC] p-3.5 rounded-xl text-sm font-medium">
                  {selectedQ.prompt}
                </div>
              </div>

              {selectedQ.options && (
                <div>
                  <h4 className="text-xs font-bold text-[#656C79] uppercase tracking-wider mb-2">
                    Options & Answer Key
                  </h4>
                  <div className="space-y-1.5">
                    {selectedQ.options.map((opt: string, idx: number) => {
                      const isCorrect = opt === selectedQ.correctAnswer;
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg text-xs font-medium border ${
                            isCorrect
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          {opt} {isCorrect && '✓ (Correct)'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedQ.passage && (
                <div>
                  <h4 className="text-xs font-bold text-[#656C79] uppercase tracking-wider mb-1">
                    Passage Excerpt
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-[#656C79] max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedQ.passage}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <a href={`/assessments/questions/${selectedQ.id}/edit`} className="flex-1">
                  <Button variant="primary" size="md" className="w-full">
                    Edit Question
                  </Button>
                </a>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
