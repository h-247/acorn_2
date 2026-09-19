'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  MetricCard,
  Card,
  Button,
  DistributionChart,
  StatusBadge,
} from '@acorn/ui';
import { FileText, Sparkles, AlertCircle, Edit3, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { api } from '@/lib/api';

export default function TeacherHomePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(() => {});
    api.getMetrics().then(setMetrics).catch(() => {});
  }, []);

  const insightItems = [
    { label: 'Main idea', value: 78, highlight: false },
    { label: 'Detail', value: 70, highlight: false },
    { label: 'Inference', value: 42, highlight: true },
    { label: 'Vocabulary', value: 75, highlight: false },
  ];

  return (
    <AppShell currentPath="/" roleMode="TEACHER">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Teacher Home</h1>
            <p className="text-sm text-[#656C79] mt-1">
              Welcome back, Ms. Taylor! Manage your English classes and create great learning experiences.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/materials/new">
              <Button variant="outline" size="md">
                + New Material
              </Button>
            </a>
            <a href="/assessments/builder">
              <Button variant="primary" size="md">
                + Create Assessment
              </Button>
            </a>
          </div>
        </div>

        {/* Needs your attention */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#082051]">Needs your attention</h2>
            <a href="/submissions" className="text-xs font-semibold text-[#0967F7] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a href="/submissions">
              <MetricCard
                icon={<FileText className="w-5 h-5 text-red-500" />}
                value={12}
                label="Submissions awaiting review"
                onClick={() => {}}
              />
            </a>
            <a href="/ai-review/dddddddd-dddd-dddd-dddd-dddddddddddd">
              <MetricCard
                icon={<Sparkles className="w-5 h-5 text-purple-600" />}
                value={5}
                label="AI candidates awaiting approval"
                onClick={() => {}}
              />
            </a>
            <a href="/learners">
              <MetricCard
                icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
                value={8}
                label="Learners needing extra practice"
                onClick={() => {}}
              />
            </a>
            <a href="/assessments">
              <MetricCard
                icon={<Edit3 className="w-5 h-5 text-blue-500" />}
                value={3}
                label="Draft assessments to complete"
                onClick={() => {}}
              />
            </a>
          </div>
        </div>

        {/* Active Classes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#082051]">Active classes</h2>
            <a href="/classes/55555555-5555-5555-5555-555555555555" className="text-xs font-semibold text-[#0967F7] hover:underline flex items-center gap-1">
              View all classes <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card hoverable className="p-5 flex flex-col justify-between border-gray-200/80">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2.5 py-1 rounded-md">
                    IELTS
                  </span>
                  <span className="text-xs text-[#656C79]">B1 • 18 learners</span>
                </div>
                <h3 className="text-lg font-bold text-[#082051] mb-1">IELTS Foundation A</h3>
                <div className="text-xs text-[#656C79] space-y-1.5 mt-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Next: <strong>Reading: Urban Farming</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Pending items: <strong>4 submissions</strong></span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                <a href="/classes/55555555-5555-5555-5555-555555555555" className="text-xs font-semibold text-[#0967F7] flex items-center gap-1">
                  Class workspace <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>

            <Card hoverable className="p-5 flex flex-col justify-between border-gray-200/80">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
                    Speaking
                  </span>
                  <span className="text-xs text-[#656C79]">B1 • 15 learners</span>
                </div>
                <h3 className="text-lg font-bold text-[#082051] mb-1">IELTS Speaking B1</h3>
                <div className="text-xs text-[#656C79] space-y-1.5 mt-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Next: <strong>Part 2: Cue Cards Practice</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Pending items: <strong>2 submissions</strong></span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                <a href="/classes/55555555-5555-5555-5555-555555555556" className="text-xs font-semibold text-[#0967F7] flex items-center gap-1">
                  Class workspace <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>

            <Card hoverable className="p-5 flex flex-col justify-between border-gray-200/80">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                    Kids
                  </span>
                  <span className="text-xs text-[#656C79]">Pre-A1 • 12 learners</span>
                </div>
                <h3 className="text-lg font-bold text-[#082051] mb-1">Kids English Starters</h3>
                <div className="text-xs text-[#656C79] space-y-1.5 mt-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Next: <strong>Vocabulary: My School</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#5969AB]" />
                    <span>Pending items: <strong>1 submission</strong></span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                <a href="/classes/55555555-5555-5555-5555-555555555557" className="text-xs font-semibold text-[#0967F7] flex items-center gap-1">
                  Class workspace <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          </div>
        </div>

        {/* Split Section: Recent Work & Class Insight */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Work */}
          <Card className="p-5 border-gray-200/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#082051]">Recent work</h3>
              <a href="/materials" className="text-xs text-[#0967F7] hover:underline">
                View all ›
              </a>
            </div>

            <div className="space-y-3">
              <a href="/materials/77777777-7777-7777-7777-777777777701" className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F3F6FC]/60 transition-colors border border-transparent hover:border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0967F7] flex items-center justify-center font-bold text-xs">
                    DOC
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#082051]">IELTS Reading: Urban Farming</h4>
                    <p className="text-[11px] text-[#656C79]">Material • Reading • Edited 2 hours ago</p>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">›</span>
              </a>

              <a href="/materials/77777777-7777-7777-7777-777777777705" className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F3F6FC]/60 transition-colors border border-transparent hover:border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    AUD
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#082051]">Listening Practice: Campus Announcements</h4>
                    <p className="text-[11px] text-[#656C79]">Material • Listening • Edited 1 day ago</p>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">›</span>
              </a>

              <a href="/assessments" className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F3F6FC]/60 transition-colors border border-transparent hover:border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    RUB
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#082051]">Speaking Task 2 Rubric</h4>
                    <p className="text-[11px] text-[#656C79]">Assessment • Speaking • Edited 2 days ago</p>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">›</span>
              </a>
            </div>
          </Card>

          {/* Class Insight (Screen B1) */}
          <Card className="p-5 border-gray-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0967F7]" />
                  <h3 className="text-base font-bold text-[#082051]">Class insight</h3>
                </div>
                <span className="text-xs text-[#656C79] bg-[#F3F6FC] px-2 py-0.5 rounded-md font-medium">
                  IELTS Foundation A
                </span>
              </div>

              <h4 className="text-sm font-bold text-[#082051] mb-1">
                Reading Inference is an emerging gap
              </h4>
              <p className="text-xs text-[#656C79] leading-relaxed">
                42% of learners in IELTS Foundation A are finding inference questions challenging. Consider adding more practice materials and targeted feedback.
              </p>

              <div className="my-4">
                <DistributionChart items={insightItems} />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-3 border-t border-gray-100">
              <a href="/classes/55555555-5555-5555-5555-555555555555" className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  Review class ›
                </Button>
              </a>
              <a href="/materials/new" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  Create practice materials
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
