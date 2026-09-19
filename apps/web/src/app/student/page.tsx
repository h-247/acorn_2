'use client';

import React from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  ProgressBar,
} from '@acorn/ui';
import { BookOpen, CheckSquare, Sparkles, ArrowRight, Clock } from 'lucide-react';

export default function StudentHomePage() {
  return (
    <AppShell
      currentPath="/student"
      userName="Emma Nguyen"
      userRole="Student • IELTS Foundation A"
      roleMode="STUDENT"
    >
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
              Student Portal
            </span>
            <h1 className="text-3xl font-extrabold mt-3 mb-2">Welcome back, Emma!</h1>
            <p className="text-blue-100 text-sm max-w-md leading-relaxed">
              You are making solid progress in IELTS Foundation A. Keep up your reading momentum today!
            </p>
          </div>
          <div className="text-6xl shrink-0">🐿️</div>
        </div>

        {/* Next Task Card */}
        <Card className="p-6 border-blue-200 bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0967F7] flex items-center justify-center shrink-0">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="primary">Reading Checkpoint</Badge>
                <span className="text-xs text-[#656C79]">Due in 5 days</span>
              </div>
              <h2 className="text-lg font-bold text-[#082051]">IELTS Reading Checkpoint 03</h2>
              <p className="text-xs text-[#656C79] mt-0.5">
                Passage: Urban Farming • 4 multiple choice questions • 20 minutes
              </p>
            </div>
          </div>

          <a href="/student/assessments/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01">
            <Button variant="primary" size="lg">
              Start Assessment ›
            </Button>
          </a>
        </Card>

        {/* Progress Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-gray-200/80 space-y-4">
            <h3 className="text-base font-bold text-[#082051]">My English Skills</h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Reading Comprehension</span>
                  <span className="text-[#0967F7]">72% (High)</span>
                </div>
                <ProgressBar value={72} size="sm" color="blue" />
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Listening</span>
                  <span className="text-emerald-700">68%</span>
                </div>
                <ProgressBar value={68} size="sm" color="emerald" />
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Speaking</span>
                  <span className="text-amber-700">62%</span>
                </div>
                <ProgressBar value={62} size="sm" color="amber" />
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Writing</span>
                  <span className="text-amber-700">58%</span>
                </div>
                <ProgressBar value={58} size="sm" color="amber" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-gray-200/80 space-y-4">
            <h3 className="text-base font-bold text-[#082051]">Recent Feedback</h3>
            <div className="bg-[#F3F6FC] rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#082051]">Ms. Taylor (Teacher)</span>
                <span className="text-[#656C79]">Apr 3, 2025</span>
              </div>
              <p className="text-[#656C79] leading-relaxed italic">
                “Good job on the urban farming reading test! Make sure to pay close attention to subtle inferences in longer paragraphs.”
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
