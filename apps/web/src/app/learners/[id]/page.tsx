'use client';

import React, { useState, useEffect } from 'react';
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
} from '@acorn/ui';
import { Sparkles, MessageSquare, ArrowRight, Target, Clock, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';

export default function LearnerProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    api.getLearnerProfile(params.id).then(setProfile).catch(() => {});
  }, [params.id]);

  if (!profile) {
    return (
      <AppShell currentPath="/learners">
        <div className="p-8 text-center text-[#656C79]">Loading learner profile...</div>
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
                    {profile.overallProficiency}% <span className="text-xs text-[#0967F7]">B1</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Solid progress • On track
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {profile.skills.map((s: any) => (
                  <LearnerSkillCard
                    key={s.skillId}
                    skill={s}
                    onSelectSubskill={(subId) => router.push(`/learners/${profile.learnerId}/evidence`)}
                  />
                ))}
              </div>
            </Card>

            {/* Progress over time */}
            <Card className="p-6 border-gray-200/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#082051]">Progress over time</h3>
                  <p className="text-xs text-[#656C79]">Weighted mastery progression</p>
                </div>
                <span className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2.5 py-1 rounded font-medium">
                  Last 6 months
                </span>
              </div>
              <ProgressTrend data={profile.progression} height={160} />
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
                  <span className="text-[#656C79]">Joined:</span>
                  <span className="font-semibold text-[#082051]">Jan 15, 2025</span>
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-xs italic text-[#082051]">
                “I want to improve my English to study abroad and feel more confident in real-life conversations.”
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-[#656C79]">Evidence coverage</span>
                  <span className="font-bold text-[#082051]">12 of 16 skills (75%)</span>
                </div>
                <ProgressBar value={75} size="sm" color="blue" />
              </div>
            </Card>

            {/* Next suggested focus card */}
            <Card className="p-5 border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
              <div className="flex items-center gap-2 mb-2 text-[#0967F7]">
                <Target className="w-4 h-4" />
                <h3 className="text-sm font-bold">Next Suggested Focus</h3>
              </div>
              <h4 className="text-base font-bold text-[#082051] mb-1">Reading • Inference</h4>
              <p className="text-xs text-[#656C79] leading-relaxed mb-4">
                Help Emma improve her ability to make inferences in longer texts, a key skill for IELTS Reading.
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
