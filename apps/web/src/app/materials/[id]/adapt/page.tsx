'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Card,
  Input,
  Textarea,
  Select,
  ErrorState,
} from '@acorn/ui';
import { Sparkles, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function MaterialAdaptationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [sourceMaterial, setSourceMaterial] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [targetLevel, setTargetLevel] = useState('B1');
  const [content, setContent] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMaterial = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const m = await api.getMaterial(params.id);
      setSourceMaterial(m);
      setTitle(`${m.title} (Adapted for ${m.level})`);
      setTargetLevel(m.level);
      setContent(m.content);
      setReason('Adapted for targeted vocabulary support and comprehension.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load source material for adaptation');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadMaterial();
  }, [loadMaterial]);

  const handleSave = async () => {
    if (!sourceMaterial) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const adapted = await api.adaptMaterial(sourceMaterial.id, {
        sourceMaterialId: sourceMaterial.id,
        title,
        targetLevel,
        contentModifications: content,
        adaptationReason: reason,
        tags: ['adapted', 'ielts'],
      });
      router.push(`/materials/${adapted.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save adaptation');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/materials" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading adaptation workspace...</div>
      </AppShell>
    );
  }

  if (errorMessage && !sourceMaterial) {
    return (
      <AppShell currentPath="/materials" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load material for adaptation"
            message={errorMessage}
            onRetry={loadMaterial}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/materials" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Materials', href: '/materials' },
            { label: sourceMaterial.title, href: `/materials/${sourceMaterial.id}` },
            { label: 'Adapt variant' },
          ]}
          title="Material Adaptation & Version Compare"
          subtitle="Create a new variant without overwriting the source material. Provenance links will be retained."
          actions={
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={handleSave}
              icon={<Check className="w-4 h-4" />}
            >
              Publish adapted variant
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Adaptation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Adapted variant title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select
            label="Target CEFR Level"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            options={[
              { label: 'Pre-A1', value: 'Pre-A1' },
              { label: 'A1', value: 'A1' },
              { label: 'A2', value: 'A2' },
              { label: 'B1', value: 'B1' },
              { label: 'B2', value: 'B2' },
            ]}
          />
          <Input
            label="Adaptation reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Original Source */}
          <Card className="p-5 border-gray-200/80">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
                Original Material (Source: {sourceMaterial.source})
              </span>
              <span className="text-xs bg-gray-100 text-[#5969AB] px-2 py-0.5 rounded font-mono">
                v{sourceMaterial.currentVersionNumber}
              </span>
            </div>
            <div className="prose text-xs text-[#656C79] whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto bg-gray-50/50 p-4 rounded-xl">
              {sourceMaterial.content}
            </div>
          </Card>

          {/* Modified Content */}
          <Card className="p-5 border-blue-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-100">
              <span className="text-xs font-bold text-[#0967F7] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Adapted Variant (New v1)
              </span>
              <span className="text-xs bg-blue-50 text-[#0967F7] px-2 py-0.5 rounded font-medium">
                Drafting
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              className="text-xs leading-relaxed font-normal bg-white"
            />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
