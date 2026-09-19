'use client';

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  SearchFilterBar,
  MetricCard,
  MaterialRow,
  Drawer,
  Button,
  StatusBadge,
  Badge,
} from '@acorn/ui';
import { BookOpen, Share2, Plus, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function MaterialLibraryPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  useEffect(() => {
    let q = '';
    if (search) q += `query=${encodeURIComponent(search)}&`;
    if (selectedSkill) q += `skill=${encodeURIComponent(selectedSkill)}&`;
    if (selectedLevel) q += `level=${encodeURIComponent(selectedLevel)}&`;
    api.getMaterials(q).then(setMaterials).catch(() => {});
  }, [search, selectedSkill, selectedLevel]);

  return (
    <AppShell currentPath="/materials" roleMode="TEACHER">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Materials</h1>
            <p className="text-sm text-[#656C79] mt-1">
              Discover, organize, and improve English learning materials for your classes.
            </p>
          </div>
          <a href="/materials/new">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              Add material
            </Button>
          </a>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <MetricCard
            icon={<BookOpen className="w-5 h-5 text-[#0967F7]" />}
            value={124}
            label="total materials"
            onClick={() => {}}
          />
          <MetricCard
            icon={<Share2 className="w-5 h-5 text-purple-600" />}
            value={18}
            label="shared with colleagues"
            onClick={() => {}}
          />
        </div>

        {/* Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search materials, topics, or keywords..."
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              id: 'skill',
              label: 'Skill',
              options: [
                { label: 'Reading', value: '66666666-6666-6666-6666-666666666601' },
                { label: 'Listening', value: '66666666-6666-6666-6666-666666666606' },
                { label: 'Speaking', value: '66666666-6666-6666-6666-666666666607' },
                { label: 'Writing', value: '66666666-6666-6666-6666-666666666608' },
              ],
              selectedValue: selectedSkill,
              onChange: setSelectedSkill,
            },
            {
              id: 'level',
              label: 'Level',
              options: [
                { label: 'Pre-A1', value: 'Pre-A1' },
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
              ],
              selectedValue: selectedLevel,
              onChange: setSelectedLevel,
            },
          ]}
          sortOptions={[
            { label: 'Newest', value: 'newest' },
            { label: 'Most Used', value: 'usage' },
          ]}
        />

        {/* Material Items List */}
        <div className="space-y-3">
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              selected={selectedMaterial?.id === m.id}
              onClick={() => setSelectedMaterial(m)}
            />
          ))}
        </div>

        {/* Right Drawer Inspection (Screen A1 & A2) */}
        <Drawer
          isOpen={!!selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          title={selectedMaterial?.title}
        >
          {selectedMaterial && (
            <div className="space-y-6">
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-50 rounded-xl flex items-center justify-center text-4xl shadow-inner">
                📖
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="primary">{selectedMaterial.primarySkillName}</Badge>
                  <Badge variant="default">{selectedMaterial.level}</Badge>
                  <span className="text-xs text-[#656C79]">
                    {selectedMaterial.estimatedMinutes} min read
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#082051] mb-2">{selectedMaterial.title}</h3>
                <p className="text-xs text-[#656C79] leading-relaxed">
                  {selectedMaterial.summary ||
                    'A structured learning asset curated for IELTS preparation. Provides comprehension exercises, vocabulary reinforcement, and guided analysis.'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <a href={`/materials/${selectedMaterial.id}`} className="flex-1">
                  <Button variant="primary" size="md" className="w-full">
                    Open detail <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
                <a href={`/materials/${selectedMaterial.id}/adapt`} className="flex-1">
                  <Button variant="secondary" size="md" className="w-full">
                    Adapt variant
                  </Button>
                </a>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-gray-100 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Source:</span>
                  <span className="font-semibold text-[#082051]">{selectedMaterial.source}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Status:</span>
                  <StatusBadge status={selectedMaterial.status} />
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Usage count:</span>
                  <span className="font-semibold text-[#082051]">{selectedMaterial.usageCount} classes</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Version:</span>
                  <span className="font-mono text-[#5969AB]">v{selectedMaterial.currentVersionNumber}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#082051] mb-2 uppercase tracking-wider">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['ielts', 'reading', 'urban life', 'inference'].map((t) => (
                    <span key={t} className="text-xs bg-[#F3F6FC] text-[#5969AB] px-2.5 py-1 rounded-lg">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
