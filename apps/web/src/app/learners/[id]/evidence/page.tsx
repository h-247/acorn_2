'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  EntityHeader,
  Button,
  Badge,
  StatusBadge,
  Card,
  EvidenceRow,
  EvidenceDetail,
  Drawer,
  ProgressTrend,
} from '@acorn/ui';
import { Download, ArrowLeft, Filter } from 'lucide-react';
import { api } from '@/lib/api';

export default function EvidenceExplorerPage({ params }: { params: { id: string } }) {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  useEffect(() => {
    api.getEvidence(`learnerId=${params.id}`).then((list) => {
      setEvidenceList(list);
      if (list.length > 0) setSelectedEvidence(list[0]);
    }).catch(() => {});
  }, [params.id]);

  const trendData = [
    { label: 'Jan 20', value: 40 },
    { label: 'Feb 3', value: 45 },
    { label: 'Feb 17', value: 50 },
    { label: 'Mar 3', value: 52 },
    { label: 'Mar 17', value: 48 },
    { label: 'Mar 31', value: 58 },
    { label: 'Apr 3', value: 54 },
  ];

  return (
    <AppShell currentPath="/learners" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Learners', href: '/learners' },
            { label: 'Emma Nguyen', href: `/learners/${params.id}` },
            { label: 'Evidence Explorer' },
          ]}
          title="Evidence Explorer"
          subtitle="Reading • Inference • Current state 54% • Medium confidence"
          actions={
            <Button variant="outline" size="md" icon={<Download className="w-4 h-4" />}>
              Export
            </Button>
          }
        />

        {/* Snapshot Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-gray-200/80">
            <span className="text-xs text-[#656C79]">Learner</span>
            <div className="text-sm font-bold text-[#082051] mt-0.5">Emma Nguyen</div>
            <span className="text-[11px] text-[#5969AB]">B1 • IELTS Foundation A</span>
          </Card>
          <Card className="p-4 border-gray-200/80">
            <span className="text-xs text-[#656C79]">Observed Skill</span>
            <div className="text-sm font-bold text-[#082051] mt-0.5">Reading • Inference</div>
            <span className="text-[11px] text-[#5969AB]">Subskill level B1</span>
          </Card>
          <Card className="p-4 border-gray-200/80">
            <span className="text-xs text-[#656C79]">Evidence retained</span>
            <div className="text-sm font-bold text-[#082051] mt-0.5">9 items</div>
            <span className="text-[11px] text-amber-700">1 teacher-corrected</span>
          </Card>
          <Card className="p-4 border-gray-200/80">
            <span className="text-xs text-[#656C79]">Last updated</span>
            <div className="text-sm font-bold text-[#082051] mt-0.5">Apr 3, 2025</div>
            <span className="text-[11px] text-[#5969AB]">by Ms. Taylor</span>
          </Card>
        </div>

        {/* Trend Graph */}
        <Card className="p-6 border-gray-200/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#082051]">
                Evidence trend (Reading • Inference)
              </h3>
              <p className="text-xs text-[#656C79]">Recent weighted observations</p>
            </div>
            <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2.5 py-1 rounded-md">
              Current: 54%
            </span>
          </div>
          <ProgressTrend data={trendData} height={140} />
        </Card>

        {/* Main List and Drilldown Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#082051]">
                Retained Evidence ({evidenceList.length} items)
              </h3>
            </div>

            <div className="space-y-2.5">
              {evidenceList.map((e) => (
                <EvidenceRow
                  key={e.id}
                  evidence={e}
                  selected={selectedEvidence?.id === e.id}
                  onClick={() => setSelectedEvidence(e)}
                />
              ))}
            </div>
          </div>

          {/* Drilldown Drawer / Card */}
          <div>
            <Card className="p-5 border-gray-200/80 sticky top-24">
              <h3 className="text-sm font-bold text-[#082051] mb-4 pb-2 border-b border-gray-100">
                Selected Evidence Inspection
              </h3>
              {selectedEvidence ? (
                <EvidenceDetail evidence={selectedEvidence} />
              ) : (
                <div className="text-xs text-[#656C79]">Select an evidence row to inspect.</div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
