'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  Card,
  Button,
  Badge,
  Input,
  Select,
  EmptyState,
  ErrorState,
} from '@acorn/ui';
import {
  BookOpen,
  Search,
  Clock,
  Download,
  Volume2,
  FileText,
  Filter,
  X,
  Sparkles,
} from 'lucide-react';
import { api, getStoredUser } from '@/lib/api';

export default function StudentMaterialsPage() {
  const [user, setUser] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Selected Material for Drawer / Reader view
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (selectedMaterial?.type === 'AUDIO' && selectedMaterial.files?.length) {
      const audioFile = selectedMaterial.files.find(
        (f: any) =>
          f.mimeType?.startsWith('audio/') ||
          /\.(mp3|wav|ogg|m4a|webm)$/i.test(f.fileName || '')
      );
      if (audioFile) {
        api.getMaterialFileDownloadUrl(selectedMaterial.id, audioFile.id)
          .then((res) => {
            if (active && res?.url) setAudioPlaybackUrl(res.url);
          })
          .catch(() => {
            if (active) setAudioPlaybackUrl(null);
          });
      } else {
        setAudioPlaybackUrl(null);
      }
    } else {
      setAudioPlaybackUrl(null);
    }
    return () => {
      active = false;
    };
  }, [selectedMaterial]);

  const loadMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let currentUser = getStoredUser();
      try {
        currentUser = await api.getMe();
      } catch {}
      setUser(currentUser);

      const data = await api.getMaterials();
      // Filter materials to APPROVED or ACTIVE
      const approved = (data || []).filter(
        (m: any) => m.status === 'APPROVED' || m.status === 'ACTIVE'
      );
      setMaterials(approved);
    } catch (err: any) {
      setError(err.message || 'Failed to load study materials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleDownloadFile = async (materialId: string, fileId: string) => {
    setDownloadingFile(fileId);
    try {
      const res = await api.getMaterialFileDownloadUrl(materialId, fileId);
      if (res?.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      alert('Could not download file: ' + err.message);
    } finally {
      setDownloadingFile(null);
    }
  };

  // Filtered materials
  const filteredMaterials = materials.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchSummary = m.summary?.toLowerCase().includes(q);
      const matchSkill = m.primarySkillName?.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchSkill) return false;
    }
    if (selectedLevel !== 'ALL' && m.level !== selectedLevel) return false;
    if (selectedType !== 'ALL' && m.type !== selectedType) return false;
    return true;
  });

  return (
    <AppShell
      currentPath="/student/materials"
      userName={user?.name || 'Student'}
      userRole="Student"
      roleMode="STUDENT"
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Study Materials</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Access center-approved English readings, listening resources, and worksheets.
          </p>
        </div>

        {/* Filter bar */}
        <Card className="p-4 bg-white border-gray-200/80 shadow-xs flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#656C79]" />
            <input
              type="text"
              placeholder="Search topics, skills, reading titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F3F6FC] rounded-xl text-sm text-[#082051] placeholder-[#656C79] border-none focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 bg-[#F3F6FC] rounded-xl text-xs font-semibold text-[#082051] border-none focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none"
            >
              <option value="ALL">All Levels</option>
              <option value="A1">A1 Level</option>
              <option value="A2">A2 Level</option>
              <option value="B1">B1 Level</option>
              <option value="B2">B2 Level</option>
              <option value="C1">C1 Level</option>
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-[#F3F6FC] rounded-xl text-xs font-semibold text-[#082051] border-none focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none"
            >
              <option value="ALL">All Formats</option>
              <option value="ARTICLE">Article / Reading</option>
              <option value="AUDIO">Audio Track</option>
              <option value="WORKSHEET">Worksheet</option>
              <option value="ACTIVITY">Activity</option>
            </select>
          </div>
        </Card>

        {/* Material Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading study materials...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState
              title="Unable to load materials"
              message={error}
              onRetry={loadMaterials}
            />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <EmptyState
            title="No study materials found"
            description="Try changing your search keywords or level filters."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLevel('ALL');
                  setSelectedType('ALL');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMaterials.map((mat) => (
              <Card
                key={mat.id}
                className="p-5 border-gray-200/80 bg-white hover:border-blue-200 transition-all flex flex-col justify-between shadow-xs hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#0967F7] bg-blue-50 px-2.5 py-0.5 rounded-full">
                      Level {mat.level}
                    </span>
                    <Badge variant="default">{mat.type}</Badge>
                  </div>

                  <h3 className="text-base font-bold text-[#082051] leading-snug line-clamp-2">
                    {mat.title}
                  </h3>

                  <p className="text-xs text-[#656C79] line-clamp-3 leading-relaxed">
                    {mat.summary || mat.content?.substring(0, 120) || 'Study material for English learners.'}
                  </p>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[#656C79]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{mat.estimatedMinutes || 15} mins</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMaterial(mat)}
                    icon={<BookOpen className="w-3.5 h-3.5" />}
                  >
                    Read & Study
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Reader Drawer / Modal */}
        {selectedMaterial && (
          <div className="fixed inset-0 bg-[#082051]/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2 py-0.5 rounded">
                      Level {selectedMaterial.level}
                    </span>
                    <Badge variant="primary">{selectedMaterial.type}</Badge>
                    <span className="text-xs text-[#656C79] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {selectedMaterial.estimatedMinutes || 15} mins
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#082051]">
                    {selectedMaterial.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedMaterial(null)}
                  className="p-1.5 text-[#656C79] hover:text-[#082051] rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#082051] leading-relaxed flex-1">
                {selectedMaterial.summary && (
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 italic text-[#5969AB]">
                    <strong>Summary:</strong> {selectedMaterial.summary}
                  </div>
                )}

                {selectedMaterial.type === 'AUDIO' && (
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#082051]">
                      <Volume2 className="w-4 h-4 text-[#0967F7]" />
                      <span>Audio Playback</span>
                    </div>
                    {audioPlaybackUrl ? (
                      <audio controls className="w-full h-8" key={audioPlaybackUrl}>
                        <source src={audioPlaybackUrl} />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <p className="text-xs text-[#656C79] italic">
                        {selectedMaterial.files?.some((f: any) => f.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(f.fileName || ''))
                          ? 'Loading authorized audio track...'
                          : 'No audio track file attached to this material.'}
                      </p>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-line font-sans text-sm leading-relaxed text-[#082051]">
                  {selectedMaterial.content}
                </div>

                {/* Attached files */}
                {selectedMaterial.files && selectedMaterial.files.length > 0 && (
                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    <span className="font-bold text-[#082051]">Attached Files:</span>
                    <div className="space-y-1.5">
                      {selectedMaterial.files.map((f: any) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 bg-[#F3F6FC] rounded-xl"
                        >
                          <span className="font-medium text-[#082051] flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#0967F7]" />
                            {f.fileName}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={downloadingFile === f.id}
                            onClick={() => handleDownloadFile(selectedMaterial.id, f.id)}
                            icon={<Download className="w-3.5 h-3.5" />}
                          >
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-[#F3F6FC]/50 flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setSelectedMaterial(null)}
                >
                  Done Reading
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
