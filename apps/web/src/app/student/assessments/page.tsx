'use client';

import React from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
} from '@acorn/ui';
import { CheckSquare, Clock } from 'lucide-react';

export default function StudentAssessmentsListPage() {
  return (
    <AppShell
      currentPath="/student/assessments"
      userName="Emma Nguyen"
      userRole="Student"
      roleMode="STUDENT"
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-[#082051]">My Assessments</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Complete assigned skill checkpoints and view past evaluation results.
          </p>
        </div>

        <div className="space-y-3">
          <Card className="p-5 border-blue-200 bg-white flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="primary">Active Now</Badge>
                <span className="text-xs text-[#656C79]">20 mins</span>
              </div>
              <h3 className="text-base font-bold text-[#082051]">IELTS Reading Checkpoint 03</h3>
              <p className="text-xs text-[#656C79]">Passage: Urban Farming • 4 questions</p>
            </div>
            <a href="/student/assessments/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01">
              <Button variant="primary" size="md">
                Open Player ›
              </Button>
            </a>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
