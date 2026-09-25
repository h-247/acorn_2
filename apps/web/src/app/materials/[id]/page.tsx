'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  EntityHeader,
  Button,
  StatusBadge,
  Badge,
  Card,
  ProvenanceLineage,
  ErrorState,
  Dialog,
  Input,
  Textarea,
  Select,
} from '@acorn/ui';
import {
  Sparkles,
  Edit3,
  ArrowLeft,
  BookOpen,
  Clock,
  Users,
  ArrowRight,
  Upload,
  Download,
  Archive,
  CheckCircle2,
  FileText,
  AlertCircle,
  Share2,
  GitCompare,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function MaterialDetailPage({ params }: { params: { id: string } }) {
  const [material, setMaterial] = useState<any | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog & Action States
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [selectedReleaseClassId, setSelectedReleaseClassId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCompareVersion, setSelectedCompareVersion] = useState<any | null>(null);

  // Edit Material State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('INTERMEDIATE');
  const [editTopic, setEditTopic] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadMaterial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, rels, clsList] = await Promise.all([
        api.getMaterial(params.id),
        api.getMaterialReleases(params.id).catch(() => []),
        api.getClasses().catch(() => []),
      ]);
      setMaterial(data);
      setReleases(rels || []);
      setClasses(clsList || []);
      if (clsList && clsList.length > 0) {
        setSelectedReleaseClassId((prev) => prev || clsList[0].id);
      }
      if (data) {
        setEditTitle(data.title || '');
        setEditSummary(data.summary || '');
        setEditContent(data.content || '');
        setEditDifficulty(data.difficulty || 'INTERMEDIATE');
        setEditTopic(data.topic || '');
        setEditTags((data.tags || []).join(', '));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load material');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadMaterial();
  }, [loadMaterial]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.uploadMaterialFile(params.id, formData);
      setMessage(`File "${file.name}" uploaded successfully!`);
      loadMaterial();
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const res = await api.getMaterialFileDownloadUrl(params.id, fileId);
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate download URL');
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.updateMaterialStatus(params.id, newStatus);
      setMessage(`Material status updated to ${newStatus}.`);
      loadMaterial();
    } catch (err: any) {
      setError(err.message || 'Failed to update material status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReleaseClassId) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.releaseMaterialToClass(params.id, selectedReleaseClassId);
      setMessage('Material successfully released to class!');
      setIsReleaseModalOpen(false);
      loadMaterial();
    } catch (err: any) {
      setError(err.message || 'Failed to release material to class');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeRelease = async (classId: string) => {
    if (!confirm('Are you sure you want to revoke this class access to the material?')) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.revokeMaterialRelease(params.id, classId);
      setMessage('Material release revoked for class.');
      loadMaterial();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke release');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setError(null);
    try {
      const parsedTags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.updateMaterial(params.id, {
        title: editTitle,
        summary: editSummary,
        content: editContent,
        difficulty: editDifficulty,
        topic: editTopic || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
      setMessage('Material updated successfully!');
      setIsEditModalOpen(false);
      loadMaterial();
    } catch (err: any) {
      setError(err.message || 'Failed to save material edits');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <AppShell currentPath="/materials" roleMode="TEACHER">
        <div className="p-12 text-center text-sm text-[#656C79]">Loading material details...</div>
      </AppShell>
    );
  }

  if (error && !material) {
    return (
      <AppShell currentPath="/materials" roleMode="TEACHER">
        <div className="p-6 max-w-xl mx-auto">
          <ErrorState
            title="Unable to load material"
            message={error}
            onRetry={loadMaterial}
          />
        </div>
      </AppShell>
    );
  }

  const lineageNodes = [
    {
      id: '1',
      title: material?.title || 'Material',
      version: material?.currentVersionNumber || 1,
      date: material?.updatedAt ? new Date(material.updatedAt).toLocaleDateString() : 'Today',
      author: material?.source || 'Acorn Teacher Library',
      isCurrent: true,
    },
    ...(material?.provenance?.sourceMaterialTitle
      ? [
          {
            id: '2',
            title: material.provenance.sourceMaterialTitle,
            version: 1,
            date: 'Original source',
            author: 'Teacher / Curriculum Author',
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
            { label: material?.title || 'Detail' },
          ]}
          title={material?.title || 'Material Detail'}
          subtitle={`Managed English learning asset • Primary skill: ${material?.primarySkillName || 'Skill'} • Difficulty: ${material?.difficulty || 'INTERMEDIATE'}`}
          badge={<StatusBadge status={material?.status || 'APPROVED'} />}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Lifecycle transitions */}
              {material?.status === 'DRAFT' && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={actionLoading}
                  onClick={() => handleStatusTransition('UNDER_REVIEW')}
                >
                  Submit for Review
                </Button>
              )}
              {material?.status === 'UNDER_REVIEW' && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading}
                    icon={<Check className="w-4 h-4" />}
                    onClick={() => handleStatusTransition('APPROVED')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => handleStatusTransition('DRAFT')}
                  >
                    Return to Draft
                  </Button>
                </>
              )}
              {material?.status === 'APPROVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={actionLoading}
                  icon={<Archive className="w-4 h-4 text-[#656C79]" />}
                  onClick={() => handleStatusTransition('ARCHIVED')}
                >
                  Archive
                </Button>
              )}
              {material?.status === 'ARCHIVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={actionLoading}
                  icon={<RotateCcw className="w-4 h-4 text-[#656C79]" />}
                  onClick={() => handleStatusTransition('DRAFT')}
                >
                  Restore to Draft
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                icon={<Edit3 className="w-4 h-4" />}
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Material
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={<Share2 className="w-4 h-4" />}
                onClick={() => setIsReleaseModalOpen(true)}
              >
                Release to Class
              </Button>

              <a href={`/materials/${material?.id}/adapt`}>
                <Button variant="secondary" size="sm" icon={<Sparkles className="w-4 h-4 text-[#0967F7]" />}>
                  Adapt variant
                </Button>
              </a>

              <a href="/assessments/builder">
                <Button variant="outline" size="sm">
                  Create assessment
                </Button>
              </a>
            </div>
          }
        />

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
                  v{material?.currentVersionNumber}
                </span>
              </div>
              <div className="prose text-sm text-[#082051] whitespace-pre-wrap leading-relaxed">
                {material?.content}
              </div>
            </Card>

            {/* Attached Files & Object Storage */}
            <Card className="p-6 border-gray-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#082051]">Attached Files & Media (S3 Storage)</h3>
                  <p className="text-xs text-[#656C79]">Private local object storage for PDFs, audio, and supplementary files.</p>
                </div>
                <div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0967F7] text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploading ? 'Uploading...' : 'Upload File'}
                    </span>
                  </label>
                </div>
              </div>

              {material?.files && material.files.length > 0 ? (
                <div className="space-y-2">
                  {material.files.map((file: any) => (
                    <div
                      key={file.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0967F7]" />
                        <span className="font-semibold text-[#082051]">{file.fileName}</span>
                        <span className="text-[11px] text-[#656C79]">
                          ({Math.round((file.fileSize || 0) / 1024)} KB)
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => handleDownload(file.id, file.fileName)}
                      >
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#656C79] italic py-2">
                  No files attached to this learning asset yet.
                </p>
              )}
            </Card>

            {/* Class Releases Card */}
            <Card className="p-6 border-gray-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#082051]">Class Releases & Cohort Access</h3>
                  <p className="text-xs text-[#656C79]">Classes whose enrolled students have permission to access and download this material.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Share2 className="w-3.5 h-3.5 text-[#0967F7]" />}
                  onClick={() => setIsReleaseModalOpen(true)}
                >
                  Release to Class
                </Button>
              </div>

              {releases && releases.length > 0 ? (
                <div className="space-y-2">
                  {releases.map((rel: any) => (
                    <div
                      key={rel.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#082051]">{rel.className || 'Class Cohort'}</span>
                        <span className="text-[11px] text-[#656C79] ml-2">
                          Released: {new Date(rel.releasedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => handleRevokeRelease(rel.classId)}
                      >
                        Revoke Access
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#656C79] italic py-2">
                  Not released to any class cohorts yet. Click &quot;Release to Class&quot; to make it available to enrolled students.
                </p>
              )}
            </Card>

            {/* Version History */}
            {material?.versions && material.versions.length > 1 && (
              <Card className="p-6 border-gray-200/80 space-y-3">
                <h3 className="text-sm font-bold text-[#082051]">Version Changelog & Compare</h3>
                <div className="space-y-2 text-xs">
                  {material.versions.map((ver: any) => (
                    <div
                      key={ver.id}
                      className="p-3 bg-[#F3F6FC]/60 rounded-xl border border-gray-100 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-[#082051]">v{ver.versionNumber}</span>
                        <span className="text-[#656C79] ml-2">{ver.changelog || 'Updated content'}</span>
                        <span className="text-[11px] text-[#656C79] block mt-0.5">
                          {new Date(ver.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {ver.versionNumber !== material.currentVersionNumber && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<GitCompare className="w-3.5 h-3.5 text-[#0967F7]" />}
                          onClick={() => setSelectedCompareVersion(ver)}
                        >
                          Compare with v{material.currentVersionNumber}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar Metadata & Lineage */}
          <div className="space-y-5">
            {/* Metadata Card */}
            <Card className="p-5 border-gray-200/80">
              <h3 className="text-sm font-bold text-[#082051] mb-3">Material Properties</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Level:</span>
                  <Badge variant="primary">{material?.level}</Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Difficulty:</span>
                  <span className="font-semibold text-[#082051]">{material?.difficulty || 'INTERMEDIATE'}</span>
                </div>
                {material?.topic && (
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-[#656C79]">Topic:</span>
                    <span className="font-semibold text-[#082051]">{material.topic}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Estimated read time:</span>
                  <span className="font-semibold text-[#082051]">{material?.estimatedMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Source repository:</span>
                  <span className="font-semibold text-[#082051]">{material?.source}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[#656C79]">Released to classes:</span>
                  <span className="font-semibold text-[#0967F7]">{releases?.length || 0} classes</span>
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

        {/* DIALOG 1: RELEASE TO CLASS */}
        <Dialog
          isOpen={isReleaseModalOpen}
          onClose={() => setIsReleaseModalOpen(false)}
          title="Release Material to Class Cohort"
        >
          <form onSubmit={handleReleaseToClass} className="space-y-4 text-xs">
            <p className="text-[#656C79]">
              Releasing this learning asset grants enrolled students permission to access, view, and download attached media.
            </p>
            <Select
              label="Select Target Class Cohort"
              value={selectedReleaseClassId}
              onChange={(e) => setSelectedReleaseClassId(e.target.value)}
              options={classes.map((c) => ({
                label: `${c.name} (${c.level}) - Teacher: ${c.teacherName || 'Assigned'}`,
                value: c.id,
              }))}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsReleaseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={actionLoading}>
                Confirm Release
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 2: VERSION COMPARISON VIEW */}
        <Dialog
          isOpen={!!selectedCompareVersion}
          onClose={() => setSelectedCompareVersion(null)}
          title={`Version Comparison: v${selectedCompareVersion?.versionNumber} vs Current v${material?.currentVersionNumber}`}
        >
          {selectedCompareVersion && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex justify-between font-bold text-[#082051] mb-2 pb-1 border-b border-gray-200">
                    <span>v{selectedCompareVersion.versionNumber} (Historical)</span>
                    <span className="text-[11px] text-[#656C79]">
                      {new Date(selectedCompareVersion.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono text-[11px] text-[#656C79]">
                    {selectedCompareVersion.content || '(No content stored for historical snapshot)'}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200">
                  <div className="flex justify-between font-bold text-[#082051] mb-2 pb-1 border-b border-blue-200">
                    <span className="text-[#0967F7]">v{material.currentVersionNumber} (Current Active)</span>
                    <span className="text-[11px] text-[#656C79]">
                      {new Date(material.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono text-[11px] text-[#082051]">
                    {material.content}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setSelectedCompareVersion(null)}>
                  Close Comparison
                </Button>
              </div>
            </div>
          )}
        </Dialog>

        {/* DIALOG 3: EDIT MATERIAL */}
        <Dialog
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Material Asset"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Topic"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                placeholder="e.g. Science, IELTS"
              />
              <Select
                label="Difficulty"
                value={editDifficulty}
                onChange={(e) => setEditDifficulty(e.target.value)}
                options={[
                  { label: 'Beginner', value: 'BEGINNER' },
                  { label: 'Intermediate', value: 'INTERMEDIATE' },
                  { label: 'Advanced', value: 'ADVANCED' },
                ]}
              />
            </div>
            <Input
              label="Tags (comma-separated)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="e.g. reading, inference, academic"
            />
            <Textarea
              label="Summary"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={2}
            />
            <Textarea
              label="Passage Content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              required
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={savingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
