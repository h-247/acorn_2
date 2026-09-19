'use client';

import React, { useState, useEffect } from 'react';
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
} from '@acorn/ui';
import { Send, Clock, CheckCircle2, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentDetailPage({ params }: { params: { id: string } }) {
  const [assessment, setAssessment] = useState<any | null>(null);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('55555555-5555-5555-5555-555555555555');
  const [dueDate, setDueDate] = useState('2025-04-10');
  const [assignedSuccess, setAssignedSuccess] = useState(false);

  useEffect(() => {
    api.getAssessment(params.id).then(setAssessment).catch(() => {});
  }, [params.id]);

  const handleAssign = async () => {
    try {
      await api.assignAssessment(params.id, {
        classId: selectedClassId,
        dueAt: new Date(dueDate).toISOString(),
      });
      setAssignedSuccess(true);
      setTimeout(() => {
        setIsAssignDrawerOpen(false);
        setAssignedSuccess(false);
      }, 1500);
    } catch (err) {
      alert('Failed to assign assessment');
    }
  };

  if (!assessment) {
    return (
      <AppShell currentPath="/assessments">
        <div className="p-8 text-center text-[#656C79]">Loading assessment...</div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Assessments', href: '/assessments' },
            { label: assessment.title },
          ]}
          title={assessment.title}
          subtitle={assessment.description || 'Structured English skill assessment'}
          badge={<StatusBadge status={assessment.status} />}
          actions={
            <Button
              variant="primary"
              size="md"
              icon={<Send className="w-4 h-4" />}
              onClick={() => setIsAssignDrawerOpen(true)}
            >
              Assign to Class
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-[#082051]">
              Questions ({assessment.items?.length || 0})
            </h3>

            {assessment.items?.map((it: any, idx: number) => (
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
            ))}
          </div>

          <div className="space-y-4">
            <Card className="p-5 border-gray-200/80 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-[#082051]">Assessment Summary</h3>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Level:</span>
                <Badge variant="primary">{assessment.level}</Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Time limit:</span>
                <span className="font-semibold text-[#082051]">{assessment.timeLimitMinutes || 20} mins</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[#656C79]">Total points:</span>
                <span className="font-semibold text-[#082051]">{assessment.totalPoints || 4} points</span>
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
                <p className="text-xs mt-1">Learners in this class now have this assessment active.</p>
              </div>
            ) : (
              <>
                <Select
                  label="Select Class"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  options={[
                    { label: 'IELTS Foundation A (18 learners)', value: '55555555-5555-5555-5555-555555555555' },
                    { label: 'IELTS Speaking B1 (15 learners)', value: '55555555-5555-5555-5555-555555555556' },
                    { label: 'Kids English Starters (12 learners)', value: '55555555-5555-5555-5555-555555555557' },
                  ]}
                />

                <Input
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />

                <Button variant="primary" size="md" onClick={handleAssign} className="w-full">
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
