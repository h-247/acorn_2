'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  EntityHeader,
  Button,
  StatusBadge,
  Badge,
  Card,
  ProvenanceLineage,
} from '@acorn/ui';
import { Sparkles, Edit3, ArrowLeft, BookOpen, Clock, Users, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function MaterialDetailPage({ params }: { params: { id: string } }) {
  const [material, setMaterial] = useState<any | null>(null);

  useEffect(() => {
    api.getMaterial(params.id).then(setMaterial).catch(() => {});
  }, [params.id]);

  if (!material) {
    return (
      <AppShell currentPath="/materials">
        <div className="p-8 text-center text-[#656C79]">Loading material details...</div>
      </AppShell>
    );
  }

  const lineageNodes = [
    {
      id: '1',
      title: material.title,
      version: material.currentVersionNumber,
      date: new Date(material.updatedAt).toLocaleDateString(),
      author: material.source,
      isCurrent: true,
    },
    ...(material.provenance?.sourceMaterialTitle
      ? [
          {
            id: '2',
            title: material.provenance.sourceMaterialTitle,
            version: 1,
            date: '2025-03-12',
            author: 'Original publisher',
            isCurrent: false,
          },
        ]
      : []),
  ];

  return (
    <AppShell currentPath="/materials" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Materials', href: '/materials' },
            { label: material.title },
          ]}
          title={material.title}
          subtitle={`Managed English learning asset • Primary skill: ${material.primarySkillName}`}
          badge={<StatusBadge status={material.status} />}
          actions={
            <>
              <a href={`/materials/${material.id}/adapt`}>
                <Button variant="secondary" size="md" icon={<Sparkles className="w-4 h-4 text-[#0967F7]" />}>
                  Adapt variant
                </Button>
              </a>
              <a href="/assessments/builder">
                <Button variant="primary" size="md">
                  Create assessment from this
                </Button>
              </a>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-gray-200/80">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0967F7]" />
                  <span className="text-sm font-bold text-[#082051]">Article Content</span>
                </div>
                <span className="text-xs text-[#656C79] font-mono">
                  v{material.currentVersionNumber}
                </span>
              </div>
              <div className="prose text-sm text-[#082051] whitespace-pre-wrap leading-relaxed">
                {material.content}
              </div>
            </Card>
          </div>

          {/* Sidebar Metadata & Lineage */}
          <div className="space-y-5">
            {/* Metadata Card */}
            <Card className="p-5 border-gray-200/80">
              <h3 className="text-sm font-bold text-[#082051] mb-3">Material Properties</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Level:</span>
                  <Badge variant="primary">{material.level}</Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Estimated read time:</span>
                  <span className="font-semibold text-[#082051]">{material.estimatedMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Source repository:</span>
                  <span className="font-semibold text-[#082051]">{material.source}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Usage across classes:</span>
                  <span className="font-semibold text-[#082051]">{material.usageCount} times</span>
                </div>
              </div>
            </Card>

            {/* Lineage & Provenance Card */}
            <Card className="p-5 border-gray-200/80">
              <h3 className="text-sm font-bold text-[#082051] mb-3">Provenance & History</h3>
              <ProvenanceLineage nodes={lineageNodes} />
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
