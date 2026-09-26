'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  Button,
  Card,
  Input,
  Textarea,
  Select,
} from '@acorn/ui';
import { Check, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function CreateMaterialPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('ARTICLE');
  // Starts empty and is filled from the taxonomy once it loads. Hard-coding
  // a seed id here is what stopped any skill created afterwards from ever
  // being picked.
  const [skillId, setSkillId] = useState('');
  const [level, setLevel] = useState('B1');
  const [difficulty, setDifficulty] = useState('INTERMEDIATE');
  const [topic, setTopic] = useState('');
  const [courseId, setCourseId] = useState('');
  const [tagsInput, setTagsInput] = useState('ielts, academic');
  const [estimatedMinutes, setEstimatedMinutes] = useState(10);
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    api.getCourses().then((c) => setCourses(c || [])).catch(() => {});

    // Archived skills are left out by the API, so the picker only ever offers
    // what the centre currently tags work with.
    api
      .getSkills({ all: true })
      .then((res: any) => {
        const rows = Array.isArray(res) ? res : res?.items || [];
        setSkills(rows);
        setSkillId((current) => current || rows[0]?.id || '');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await api.createMaterial({
        title,
        type,
        primarySkillId: skillId,
        level,
        difficulty,
        topic: topic || undefined,
        courseId: courseId || undefined,
        estimatedMinutes: Number(estimatedMinutes),
        content,
        summary,
        source: 'Teacher Library',
        tags: tags.length > 0 ? tags : ['custom', 'english'],
      });
      router.push(`/materials/${res.id}`);
    } catch (err: any) {
      alert('Failed to create material: ' + (err.message || 'Error'));
      setSaving(false);
    }
  };

  return (
    <AppShell currentPath="/materials" roleMode="TEACHER">
      <form onSubmit={handleSubmit} className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'Materials', href: '/materials' },
            { label: 'Create new' },
          ]}
          title="Create New Material"
          subtitle="Structure and publish an English learning asset to your center repository."
          actions={
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              icon={<Check className="w-4 h-4" />}
            >
              Save & Publish
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 border-gray-200/80 space-y-4">
              <Input
                label="Material Title"
                placeholder="e.g. IELTS Reading: Urban Farming"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Topic / Subject"
                  placeholder="e.g. Environmental Science, Urban Planning"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <Input
                  label="Tags (comma-separated)"
                  placeholder="e.g. ielts, reading, urban-farming"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <Textarea
                label="Passage / Main Content"
                placeholder="Write or paste your article, transcript, or instructions here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                required
              />

              <Textarea
                label="Summary / Teaching Notes"
                placeholder="Brief description of the material and key objectives..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
              />
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 border-gray-200/80 space-y-4">
              <h3 className="text-sm font-bold text-[#082051]">Academic Properties</h3>

              <Select
                label="Difficulty Level"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                options={[
                  { label: 'Beginner', value: 'BEGINNER' },
                  { label: 'Intermediate', value: 'INTERMEDIATE' },
                  { label: 'Advanced', value: 'ADVANCED' },
                ]}
              />

              <Select
                label="Primary Skill Focus"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                options={skills.map(s => ({
                  label: `${s.area} • ${s.name}`,
                  value: s.id
                }))}
              />

              <Select
                label="Associated Course (Optional)"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                options={[
                  { label: 'None (Global Center Library)', value: '' },
                  ...courses.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.id })),
                ]}
              />

              <Select
                label="Material Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                options={[
                  { label: 'Article', value: 'ARTICLE' },
                  { label: 'Audio', value: 'AUDIO' },
                  { label: 'Worksheet', value: 'WORKSHEET' },
                  { label: 'Activity', value: 'ACTIVITY' },
                  { label: 'Flashcards', value: 'FLASHCARDS' },
                  { label: 'Rubric', value: 'RUBRIC' },
                ]}
              />

              <Select
                label="Primary Skill"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                options={
                  skills.length > 0
                    ? skills.map((s: any) => ({
                        label: s.parentId ? `\u00a0\u00a0\u00a0\u00a0${s.name}` : s.name,
                        value: s.id,
                      }))
                    : [{ label: 'Loading skills…', value: '' }]
                }
              />

              <Select
                label="Target CEFR Level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                options={[
                  { label: 'Pre-A1', value: 'Pre-A1' },
                  { label: 'A1', value: 'A1' },
                  { label: 'A2', value: 'A2' },
                  { label: 'B1', value: 'B1' },
                  { label: 'B2', value: 'B2' },
                  { label: 'C1', value: 'C1' },
                ]}
              />

              <Input
                label="Estimated Duration (minutes)"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
