'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  SearchFilterBar,
  Button,
  Badge,
  Card,
  Avatar,
  ProgressBar,
} from '@acorn/ui';
import { Users, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function LearnerDirectoryPage() {
  const [learners, setLearners] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getLearners(search ? `query=${encodeURIComponent(search)}` : '').then(setLearners).catch(() => {});
  }, [search]);

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Learner Directory</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Track student proficiency, skill progress, and evidence coverage across all classes.
          </p>
        </div>

        <SearchFilterBar
          searchPlaceholder="Search learners by name or email..."
          searchValue={search}
          onSearchChange={setSearch}
        />

        <div className="space-y-3">
          {learners.map((l) => (
            <Card
              key={l.id}
              hoverable
              className="p-5 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <Avatar name={l.name} src={l.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-[#082051]">{l.name}</h3>
                    <Badge variant="primary">{l.level}</Badge>
                    {l.needsAttention && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
                        Needs extra practice
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#656C79]">{l.email} • {l.className}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0 w-full md:w-auto justify-between md:justify-end">
                <div className="w-28 text-right">
                  <div className="text-xs font-bold text-[#082051]">{l.overallProficiency}% overall</div>
                  <ProgressBar value={l.overallProficiency} size="sm" color="blue" />
                </div>
                <a href={`/learners/${l.id}`}>
                  <Button variant="secondary" size="sm">
                    View profile ›
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
