'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  SearchFilterBar,
  Button,
  Badge,
  StatusBadge,
  Card,
  ErrorState,
  EmptyState,
} from '@acorn/ui';
import { FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function SubmissionsInboxPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getClasses().then((res) => setClasses(res || [])).catch(() => {});
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (classFilter) params.append('classId', classFilter);
      const queryString = params.toString();
      const data = await api.getSubmissions(queryString);
      setSubmissions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions inbox');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, classFilter]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.learnerName?.toLowerCase().includes(q) ||
      s.assessmentTitle?.toLowerCase().includes(q) ||
      s.className?.toLowerCase().includes(q)
    );
  });

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
          searchPlaceholder="Search by student, class, or assessment..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              id: 'status',
              label: 'Status',
              options: [
                { label: 'All Statuses', value: '' },
                { label: 'Submitted (Awaiting review)', value: 'SUBMITTED' },
                { label: 'Evaluated (Completed)', value: 'EVALUATED' },
                { label: 'Late Submissions', value: 'LATE' },
              ],
              selectedValue: statusFilter,
              onChange: setStatusFilter,
            },
            {
              id: 'class',
              label: 'Class',
              options: [
                { label: 'All Classes', value: '' },
                ...classes.map((c) => ({ label: c.name, value: c.id })),
              ],
              selectedValue: classFilter,
              onChange: setClassFilter,
            },
          ]}
        />

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading submissions...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load submissions"
              message={error}
              onRetry={loadSubmissions}
            />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState
            title="No submissions found"
            description={
              statusFilter || classFilter || searchQuery
                ? 'No submissions match the current filter or search criteria.'
                : 'No student submissions are awaiting grading or review.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((s) => (
              <Card
                key={s.id}
                hoverable
                className="p-5 border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[#082051]">{s.learnerName}</span>
                    <Badge variant="primary">{s.learnerLevel}</Badge>
                    {s.className && <Badge variant="default">{s.className}</Badge>}
                    <StatusBadge
                      status={s.status === 'EVALUATED' ? 'approved' : 'under-review'}
                      label={s.status === 'EVALUATED' ? 'Evaluated' : 'Needs Review'}
                    />
                    {s.isLate && (
                      <Badge variant="warning">
                        Late ({s.lateMinutes}m)
                      </Badge>
                    )}
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
        )}
      </div>
    </AppShell>
  );
}
