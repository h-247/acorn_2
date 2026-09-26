'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  StatusBadge,
  EmptyState,
  ErrorState,
} from '@acorn/ui';
import { CheckSquare, Clock, CheckCircle2, AlertCircle, Award } from 'lucide-react';
import { api, getStoredUser } from '@/lib/api';

export default function StudentAssessmentsListPage() {
  const [user, setUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let currentUser = getStoredUser();
      try {
        currentUser = await api.getMe();
      } catch {
        // fallback
      }
      setUser(currentUser);

      const subs = await api.getSubmissions();
      setSubmissions(subs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const userName = user?.name || 'Student';

  const activeSubmissions = submissions.filter(
    (s) => s.status === 'STARTED' || s.status === 'IN_PROGRESS'
  );

  const completedSubmissions = submissions.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'EVALUATED'
  );

  return (
    <AppShell
      currentPath="/student/assessments"
      userName={userName}
      userRole="Student"
      roleMode="STUDENT"
    >
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-[#082051]">My Assessments</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Complete assigned skill checkpoints and review past evaluation results.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading assessments...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load assessments"
              message={error}
              onRetry={loadData}
            />
          </div>
        ) : (
          <>
            {/* Active Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                <h2 className="text-base font-bold text-[#082051]">
                  Active & In Progress ({activeSubmissions.length})
                </h2>
              </div>

              {activeSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {activeSubmissions.map((sub) => {
                    const isOverdue = sub.dueAt && new Date(sub.dueAt).getTime() < Date.now();
                    const isDueSoon =
                      sub.dueAt &&
                      !isOverdue &&
                      new Date(sub.dueAt).getTime() - Date.now() < 24 * 3600 * 1000;

                    return (
                      <Card
                        key={sub.id}
                        className="p-5 border-blue-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant={sub.isClosed ? 'default' : 'primary'}>
                              {sub.isClosed
                                ? 'Closed'
                                : sub.status === 'IN_PROGRESS'
                                  ? 'In Progress'
                                  : 'Ready to Start'}
                            </Badge>
                            {sub.learnerLevel && (
                              <span className="text-xs text-[#656C79] font-medium">
                                Level {sub.learnerLevel}
                              </span>
                            )}
                            {sub.timeLimitMinutes && (
                              <span className="text-xs text-[#5969AB] font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {sub.timeLimitMinutes} mins
                              </span>
                            )}
                            {isOverdue ? (
                              <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Overdue (Due{' '}
                                {new Date(sub.dueAt).toLocaleDateString()})
                              </span>
                            ) : isDueSoon ? (
                              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Due Soon ({new Date(sub.dueAt).toLocaleDateString()})
                              </span>
                            ) : sub.dueAt ? (
                              <span className="text-xs text-[#656C79]">
                                Due: {new Date(sub.dueAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-base font-bold text-[#082051]">
                            {sub.assessmentTitle || 'Assessment Checkpoint'}
                          </h3>
                          <p className="text-xs text-[#656C79]">
                            {sub.isClosed
                              ? 'Your teacher closed this assessment. It no longer accepts answers.'
                              : 'Assigned checkpoint • Autosave enabled • Complete all questions to submit'}
                          </p>
                        </div>

                        {/* A closed paper refuses autosave and submit, so offering
                            the player would only lead to an error mid-attempt. */}
                        {sub.isClosed ? (
                          <Button variant="outline" size="md" disabled>
                            Closed
                          </Button>
                        ) : (
                          <a href={`/student/assessments/${sub.id}`}>
                            <Button variant="primary" size="md">
                              {sub.status === 'IN_PROGRESS' ? 'Resume Player ›' : 'Open Player ›'}
                            </Button>
                          </a>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-xs text-[#656C79] border-dashed">
                  No active assessments currently assigned.
                </Card>
              )}
            </div>

            {/* Completed Section */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                <h2 className="text-base font-bold text-[#082051]">
                  Past Submissions & Results ({completedSubmissions.length})
                </h2>
              </div>

              {completedSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {completedSubmissions.map((sub) => (
                    <Card
                      key={sub.id}
                      className="p-5 border-gray-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={sub.status === 'EVALUATED' ? 'success' : 'default'}>
                            {sub.status === 'EVALUATED' ? 'Evaluated' : 'Awaiting Review'}
                          </Badge>
                          <span className="text-xs text-[#656C79]">
                            Submitted {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'recently'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#082051]">
                          {sub.assessmentTitle || 'Assessment Checkpoint'}
                        </h3>
                        {sub.teacherFeedback && (
                          <p className="text-xs text-[#656C79] italic bg-gray-50 p-2 rounded-lg mt-1 max-w-xl">
                            “{sub.teacherFeedback}”
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {sub.overallScore != null ? (
                          <div className="text-right">
                            <span className="text-xs text-[#656C79]">Overall Score</span>
                            <div className="text-xl font-bold text-[#0967F7]">{sub.overallScore}%</div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#656C79] italic">Pending score</span>
                        )}

                        <a href={`/student/assessments/${sub.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6 text-center text-xs text-[#656C79] border-dashed">
                  No past assessment submissions recorded.
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
