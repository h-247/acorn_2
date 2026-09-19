'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  Card,
  Avatar,
  ProgressBar,
} from '@acorn/ui';
import { Users, Send, ArrowRight, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';

export default function ClassWorkspacePage({ params }: { params: { id: string } }) {
  const [cls, setCls] = useState<any | null>(null);

  useEffect(() => {
    api.getClass(params.id).then(setCls).catch(() => {});
  }, [params.id]);

  if (!cls) {
    return (
      <AppShell currentPath="/classes">
        <div className="p-8 text-center text-[#656C79]">Loading class workspace...</div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/classes" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Classes', href: '/classes' },
            { label: cls.name },
          ]}
          title={cls.name}
          subtitle={`${cls.courseName} • Teacher: ${cls.teacherName} • ${cls.learnerCount} learners enrolled`}
          badge={<Badge variant="primary">{cls.level}</Badge>}
          actions={
            <a href="/assessments/builder">
              <Button variant="primary" size="md">
                + Assign New Activity
              </Button>
            </a>
          }
        />

        {/* Enrolled Learners Roster */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#082051]">Class Roster ({cls.learners?.length || 0})</h3>
          </div>

          <div className="space-y-3">
            {cls.learners?.map((l: any) => (
              <Card key={l.id} hoverable className="p-4 border-gray-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={l.name} size="sm" />
                  <div>
                    <h4 className="text-sm font-bold text-[#082051]">{l.name}</h4>
                    <p className="text-xs text-[#656C79]">{l.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-24 text-right">
                    <span className="text-xs font-bold text-[#082051]">{l.overallProficiency || 68}%</span>
                    <ProgressBar value={l.overallProficiency || 68} size="sm" color="blue" />
                  </div>
                  <a href={`/learners/${l.id}`}>
                    <Button variant="secondary" size="sm">
                      Profile ›
                    </Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
