'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  StatusBadge,
} from '@acorn/ui';
import { Sparkles, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function AIReviewIndexPage() {
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    api.getAICandidates().then(setCandidates).catch(() => {});
  }, []);

  return (
    <AppShell currentPath="/ai-review" roleMode="TEACHER">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">AI Content Review</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Teacher-in-the-loop review queue for AI-generated and AI-adapted English learning materials.
          </p>
        </div>

        <div className="space-y-3">
          {candidates.map((c) => (
            <Card
              key={c.id}
              hoverable
              className="p-5 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="purple">AI Candidate</Badge>
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-[#656C79]">Provider: {c.provider} ({c.model})</span>
                </div>
                <h3 className="text-base font-bold text-[#082051] mb-1">
                  {c.targetSkillName} ({c.targetLevel})
                </h3>
                <p className="text-xs text-[#656C79] line-clamp-1">{c.promptSummary}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a href={`/ai-review/${c.id}`}>
                  <Button variant="primary" size="sm">
                    Open review ›
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
