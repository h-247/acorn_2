'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  ErrorState,
  EmptyState,
} from '@acorn/ui';
import { Users, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function ClassesListPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getClasses();
      setClasses(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  return (
    <AppShell currentPath="/classes" roleMode="TEACHER">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Classes</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Active English courses, cohort rosters, and learning activities.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading classes...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load classes"
              message={error}
              onRetry={loadClasses}
            />
          </div>
        ) : classes.length === 0 ? (
          <EmptyState
            title="No classes assigned"
            description="No active English classes are currently assigned to your teacher account."
          />
        ) : (
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
                    <p>Next: <strong>{c.nextActivity || 'No active activity'}</strong></p>
                    <p>Pending review: <strong>{c.pendingSubmissionsCount || 0} submissions</strong></p>
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
        )}
      </div>
    </AppShell>
  );
}
