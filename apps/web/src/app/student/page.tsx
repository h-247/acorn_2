'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  ProgressBar,
  EmptyState,
  ErrorState,
} from '@acorn/ui';
import { BookOpen, CheckSquare, Sparkles, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { api, getStoredUser } from '@/lib/api';

export default function StudentHomePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
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
        // fallback to stored user if any
      }
      setUser(currentUser);

      if (currentUser?.id) {
        const [prof, subs, rec] = await Promise.all([
          api.getLearnerProfile(currentUser.id),
          api.getSubmissions(),
          api.getRecommendation(currentUser.id).catch(() => null),
        ]);
        setProfile(prof);
        setSubmissions(subs || []);
        setRecommendation(rec);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student portal data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSub = submissions.find(
    (s) => s.status === 'STARTED' || s.status === 'IN_PROGRESS'
  );

  const evaluatedWithFeedback = submissions.find(
    (s) => s.status === 'EVALUATED' && s.teacherFeedback
  );

  const userName = user?.name || 'Student';
  const firstName = userName.split(' ')[0] || 'Learner';
  const className = profile?.className || 'Acorn English';

  return (
    <AppShell
      currentPath="/student"
      userName={userName}
      userRole={`Student • ${className}`}
      roleMode="STUDENT"
    >
      <div className="space-y-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading student portal...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load student portal"
              message={error}
              onRetry={loadData}
            />
          </div>
        ) : (
          <>
            {/* Welcome Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  Student Portal
                </span>
                <h1 className="text-3xl font-extrabold mt-3 mb-2">Welcome back, {firstName}!</h1>
                <p className="text-blue-100 text-sm max-w-md leading-relaxed">
                  {profile?.level
                    ? `You are currently studying in ${className} (${profile.level} level). Keep up your learning momentum today!`
                    : `Welcome to your learning dashboard. Check your active checkpoints and skill progress.`}
                </p>
              </div>
              <div className="text-6xl shrink-0">🐿️</div>
            </div>

            {/* Next Task Card */}
            {activeSub ? (
              <Card className="p-6 border-blue-200 bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0967F7] flex items-center justify-center shrink-0">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="primary">Active Checkpoint</Badge>
                      <span className="text-xs text-[#656C79]">
                        Status: {activeSub.status === 'IN_PROGRESS' ? 'In Progress' : 'Ready to Start'}
                      </span>
                      {activeSub.timeLimitMinutes && (
                        <span className="text-xs text-[#5969AB] font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {activeSub.timeLimitMinutes} mins
                        </span>
                      )}
                      {activeSub.dueAt && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            new Date(activeSub.dueAt).getTime() < Date.now()
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {new Date(activeSub.dueAt).getTime() < Date.now() ? 'Overdue: ' : 'Due: '}
                          {new Date(activeSub.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-[#082051]">{activeSub.assessmentTitle}</h2>
                    <p className="text-xs text-[#656C79] mt-0.5">
                      Assigned skill checkpoint • Complete questions and submit for evaluation
                    </p>
                  </div>
                </div>

                <a href={`/student/assessments/${activeSub.id}`}>
                  <Button variant="primary" size="lg">
                    {activeSub.status === 'IN_PROGRESS' ? 'Resume Assessment ›' : 'Start Assessment ›'}
                  </Button>
                </a>
              </Card>
            ) : (
              <Card className="p-6 border-gray-200 bg-white shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#082051]">All Caught Up!</h2>
                    <p className="text-xs text-[#656C79]">
                      No active assessment is currently due. You can review your completed tests or explore study materials anytime.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href="/student/materials">
                    <Button variant="outline" size="md">
                      Browse Materials
                    </Button>
                  </a>
                  <a href="/student/assessments">
                    <Button variant="primary" size="md">
                      Past Assessments
                    </Button>
                  </a>
                </div>
              </Card>
            )}

            {/* Recommended Next Activity (only approved activities) */}
            {recommendation && recommendation.decisionStatus === 'ACCEPT' && (
              <Card
                className="p-6 border-indigo-100 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-white shadow-sm"
                data-testid="student-recommendation-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0967F7] bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                        Recommended Next Step
                      </span>
                      <span className="text-xs text-[#656C79]">
                        Focus Area: <strong data-testid="rec-skill">{recommendation.targetSkillName || 'Skill Practice'}</strong>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#082051]" data-testid="rec-title">
                      {recommendation.candidates?.[0]?.title ||
                        recommendation.recommendedActionText ||
                        'Targeted Practice Asset'}
                    </h3>
                    <div className="text-xs text-[#656C79] leading-relaxed" data-testid="rec-rationale">
                      {Array.isArray(recommendation.rationale) && recommendation.rationale.length > 0 ? (
                        <p>{recommendation.rationale.join(' ')}</p>
                      ) : recommendation.rationale?.texts && Array.isArray(recommendation.rationale.texts) ? (
                        <p>{recommendation.rationale.texts.join(' ')}</p>
                      ) : (
                        <p>
                          {typeof recommendation.rationale === 'string'
                            ? recommendation.rationale
                            : 'Grounded in your recent assessment evidence, working on this material will help reinforce your target skills.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <a href="/student/materials">
                    <Button variant="primary" size="md">
                      Open Study Materials ›
                    </Button>
                  </a>
                </div>
              </Card>
            )}

            {/* Progress Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 border-gray-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#082051]">My English Skills</h3>
                  {profile?.overallProficiency != null && (
                    <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2 py-1 rounded">
                      Overall: {profile.overallProficiency}%
                    </span>
                  )}
                </div>

                {profile?.skills && profile.skills.length > 0 ? (
                  <div className="space-y-3.5 text-xs">
                    {profile.skills.map((s: any) => {
                      const hasData = s.scorePercentage != null;
                      const scoreVal = hasData ? s.scorePercentage : 0;
                      const color = scoreVal >= 75 ? 'blue' : scoreVal >= 60 ? 'emerald' : 'amber';
                      return (
                        <div key={s.skillId}>
                          <div className="flex justify-between font-semibold mb-1">
                            <span className="text-[#082051]">{s.skillName}</span>
                            <span className={hasData ? 'text-[#0967F7]' : 'text-[#656C79]'}>
                              {hasData ? `${scoreVal}% (${s.confidence})` : 'NO_DATA'}
                            </span>
                          </div>
                          <ProgressBar value={scoreVal} size="sm" color={color} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#656C79] py-4">
                    No skill observations recorded yet. Complete an assessment to begin tracking proficiency.
                  </p>
                )}
              </Card>

              <Card className="p-6 border-gray-200/80 space-y-4">
                <h3 className="text-base font-bold text-[#082051]">Recent Feedback</h3>
                {evaluatedWithFeedback ? (
                  <div className="bg-[#F3F6FC] rounded-2xl p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#082051]">
                        {evaluatedWithFeedback.assessmentTitle}
                      </span>
                      <span className="text-[#656C79]">
                        {evaluatedWithFeedback.evaluatedAt
                          ? new Date(evaluatedWithFeedback.evaluatedAt).toLocaleDateString()
                          : 'Recently'}
                      </span>
                    </div>
                    <p className="text-[#656C79] leading-relaxed italic">
                      “{evaluatedWithFeedback.teacherFeedback}”
                    </p>
                    {evaluatedWithFeedback.overallScore != null && (
                      <div className="text-right font-bold text-[#0967F7]">
                        Score: {evaluatedWithFeedback.overallScore}%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#F3F6FC] rounded-2xl p-6 text-xs text-center text-[#656C79]">
                    No teacher feedback recorded yet. Once your assignments are evaluated, teacher notes will appear here.
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
