'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  SearchFilterBar,
  Button,
  Badge,
  StatusBadge,
  Card,
} from '@acorn/ui';
import { FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function SubmissionsInboxPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    api.getSubmissions(statusFilter ? `status=${statusFilter}` : '').then(setSubmissions).catch(() => {});
  }, [statusFilter]);

  return (
    <AppShell currentPath="/submissions" roleMode="TEACHER">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Submission Inbox</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Teacher grading queue: review answers, score rubrics, and generate traceable learning evidence.
          </p>
        </div>

        <SearchFilterBar
          searchPlaceholder="Search by student or assessment..."
          searchValue=""
          onSearchChange={() => {}}
          filters={[
            {
              id: 'status',
              label: 'Status',
              options: [
                { label: 'Submitted (Awaiting review)', value: 'SUBMITTED' },
                { label: 'Evaluated (Completed)', value: 'EVALUATED' },
              ],
              selectedValue: statusFilter,
              onChange: setStatusFilter,
            },
          ]}
        />

        <div className="space-y-3">
          {submissions.map((s) => (
            <Card
              key={s.id}
              hoverable
              className="p-5 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-[#082051]">{s.learnerName}</span>
                  <Badge variant="primary">{s.learnerLevel}</Badge>
                  <StatusBadge
                    status={s.status === 'EVALUATED' ? 'approved' : 'under-review'}
                    label={s.status === 'EVALUATED' ? 'Evaluated' : 'Needs Review'}
                  />
                  {s.submittedAt && (
                    <span className="text-xs text-[#656C79]">
                      Submitted: {new Date(s.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#082051] mb-1">{s.assessmentTitle}</h3>
                {s.overallScore !== null && (
                  <p className="text-xs font-semibold text-emerald-700">
                    Score: {s.overallScore} / {s.maxPossibleScore}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a href={`/submissions/${s.id}/review`}>
                  <Button variant="primary" size="sm">
                    {s.status === 'EVALUATED' ? 'View Review ›' : 'Review & Grade ›'}
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
