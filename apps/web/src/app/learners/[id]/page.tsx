'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  Card,
  Avatar,
  LearnerSkillCard,
  ProgressTrend,
  ProgressBar,
  ErrorState,
} from '@acorn/ui';
import { Sparkles, MessageSquare, ArrowRight, Target, Clock, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';

export default function LearnerProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLearnerProfile(params.id);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load learner profile');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <AppShell currentPath="/learners" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading learner profile...</div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell currentPath="/learners" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load learner profile"
            message={error || 'Learner not found or access denied.'}
            onRetry={loadProfile}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        {/* Learner Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-[#082051]">{profile.name}</h1>
                <Badge variant="primary">{profile.level}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2 py-0.5 rounded">
                  Adult Learner
                </span>
                <span className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2 py-0.5 rounded">
                  IELTS Preparation
                </span>
                <span className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2 py-0.5 rounded">
                  Morning Class (Tue/Thu)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a href={`/learners/${profile.learnerId}/recommendation`}>
              <Button variant="primary" size="md" icon={<Sparkles className="w-4 h-4" />}>
                View recommendation
              </Button>
            </a>
            <a href={`/learners/${profile.learnerId}/evidence`}>
              <Button variant="outline" size="md">
                Evidence Explorer
              </Button>
            </a>
          </div>
        </div>

        {/* Profile Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Cols: English Skills Profile & Progress Trend */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-gray-200/80">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-[#082051]">English skills profile</h2>
                  <p className="text-xs text-[#656C79]">
                    Derived from {profile.totalEvidenceCount} retained evidence observations.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-[#082051]">
                    {profile.overallProficiency != null ? `${profile.overallProficiency}%` : 'NO_DATA'}{' '}
                    <span className="text-xs text-[#0967F7]">{profile.level}</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Solid progress • On track
                  </span>
                </div>
              </div>

              {profile.skills && profile.skills.length > 0 ? (
                <div className="space-y-3">
                  {profile.skills.map((s: any) => (
                    <LearnerSkillCard
                      key={s.skillId}
                      skill={s}
                      onSelectSubskill={(subId) => router.push(`/learners/${profile.learnerId}/evidence`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#656C79] border border-dashed border-gray-200 rounded-xl">
                  No skills assessed yet for this learner.
                </div>
              )}
            </Card>

              {/* Progress over time */}
              <Card className="p-6 border-gray-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#082051]">Progress over time</h3>
                    <p className="text-xs text-[#656C79]">Weighted mastery progression</p>
                  </div>
                  <span className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2.5 py-1 rounded font-medium">
                    Authoritative History
                  </span>
                </div>
                {(() => {
                  const trendData = (profile.progression || [])
                    .map((p: any) => ({
                      label: p.label || '',
                      value: typeof p.value === 'number' && isFinite(p.value)
                        ? p.value
                        : typeof p.scorePercentage === 'number' && isFinite(p.scorePercentage)
                          ? p.scorePercentage
                          : null,
                    }))
                    .filter((p: any) => p.value !== null) as { label: string; value: number }[];

                  if (trendData.length === 0) {
                    return (
                      <div className="h-[160px] flex items-center justify-center text-xs text-[#656C79] border border-dashed border-gray-200 rounded-xl">
                        No progression data yet — complete assessments to see your trend.
                      </div>
                    );
                  }
                  return <ProgressTrend data={trendData} height={160} />;
                })()}
              </Card>

          </div>

          {/* Right Col: Snapshot & Next Suggested Focus */}
          <div className="space-y-6">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Learner Snapshot</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Full name:</span>
                  <span className="font-semibold text-[#082051]">{profile.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Current Level:</span>
                  <Badge variant="primary">{profile.level}</Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Program:</span>
                  <span className="font-semibold text-[#082051]">IELTS Foundation A</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Retained Observations:</span>
                  <span className="font-semibold text-[#082051]">{profile.totalEvidenceCount}</span>
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-xs italic text-[#082051]">
                “Focused on strengthening foundational grammar and reading comprehension.”
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-[#656C79]">Evidence coverage</span>
                  <span className="font-bold text-[#082051]">
                    {Math.round((profile.skillsCoverageRatio || 0) * 100)}%
                  </span>
                </div>
                <ProgressBar value={Math.round((profile.skillsCoverageRatio || 0) * 100)} size="sm" color="blue" />
              </div>
            </Card>

            {/* Next suggested focus card */}
            <Card className="p-5 border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
              <div className="flex items-center gap-2 mb-2 text-[#0967F7]">
                <Target className="w-4 h-4" />
                <h3 className="text-sm font-bold">Next Suggested Focus</h3>
              </div>
              <h4 className="text-base font-bold text-[#082051] mb-1">
                {profile.currentFocus || 'Targeted Skill Practice'}
              </h4>
              <p className="text-xs text-[#656C79] leading-relaxed mb-4">
                Recommended learning activity based on {profile.name}&apos;s recent evidence patterns.
              </p>
              <a href={`/learners/${profile.learnerId}/recommendation`}>
                <Button variant="primary" size="sm" className="w-full">
                  View recommendation ›
                </Button>
              </a>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
