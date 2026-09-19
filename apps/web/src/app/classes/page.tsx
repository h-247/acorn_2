'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
} from '@acorn/ui';
import { Users, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function ClassesListPage() {
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(() => {});
  }, []);

  return (
    <AppShell currentPath="/classes" roleMode="TEACHER">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Classes</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Active English courses, cohort rosters, and learning activities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {classes.map((c) => (
            <Card key={c.id} hoverable className="p-5 border-gray-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="primary">{c.level}</Badge>
                  <span className="text-xs text-[#656C79]">{c.learnerCount} learners</span>
                </div>
                <h3 className="text-lg font-bold text-[#082051] mb-1">{c.name}</h3>
                <p className="text-xs text-[#656C79] mb-3">{c.courseName}</p>

                <div className="text-xs text-[#656C79] space-y-1 pt-2 border-t border-gray-100">
                  <p>Next: <strong>{c.nextActivity || 'Reading: Urban Farming'}</strong></p>
                  <p>Pending review: <strong>{c.pendingSubmissionsCount || 4} submissions</strong></p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                <a href={`/classes/${c.id}`} className="text-xs font-semibold text-[#0967F7] flex items-center gap-1">
                  Class workspace <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
