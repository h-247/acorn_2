'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  Button,
  Badge,
  StatusBadge,
  Card,
  SearchFilterBar,
} from '@acorn/ui';
import { Plus, CheckSquare, Clock, ArrowRight, Layers } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentsListPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getAssessments().then(setAssessments).catch(() => {});
  }, []);

  return (
    <AppShell currentPath="/assessments" roleMode="TEACHER">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Assessments</h1>
            <p className="text-sm text-[#656C79] mt-1">
              Design, publish, and assign skill checkpoints and reading assessments.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <a href="/assessments/questions">
              <Button variant="outline" size="md">
                Question Bank
              </Button>
            </a>
            <a href="/assessments/builder">
              <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
                Create Assessment
              </Button>
            </a>
          </div>
        </div>

        <SearchFilterBar
          searchPlaceholder="Search assessments by title or skill..."
          searchValue={search}
          onSearchChange={setSearch}
        />

        <div className="space-y-3">
          {assessments.map((a) => (
            <Card
              key={a.id}
              hoverable
              className="p-5 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="primary">{a.level}</Badge>
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-[#656C79] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {a.timeLimitMinutes || 20} mins
                  </span>
                  <span className="text-xs text-[#656C79]">
                    • {a.items?.length || 4} questions
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#082051] mb-1">{a.title}</h3>
                <p className="text-xs text-[#656C79] line-clamp-1">{a.description}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a href={`/assessments/${a.id}`}>
                  <Button variant="secondary" size="sm">
                    View & Assign ›
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
