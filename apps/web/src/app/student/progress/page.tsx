'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell, Badge, Card, EmptyState, ErrorState, ProgressBar } from '@acorn/ui';
import { BarChart3, Target, TrendingUp } from 'lucide-react';
import { api, getStoredUser } from '@/lib/api';

function scoreColor(score: number | null) {
  if (score === null) return 'blue';
  if (score >= 75) return 'blue';
  if (score >= 60) return 'emerald';
  return 'amber';
}

export default function StudentProgressPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let currentUser = getStoredUser();
      try {
        currentUser = await api.getMe();
      } catch {
        // The stored identity keeps the retry path useful while a session refresh is in flight.
      }
      setUser(currentUser);
      if (!currentUser?.id) throw new Error('Please sign in again to view your progress.');
      const [prof, evs] = await Promise.all([
        api.getLearnerProfile(currentUser.id),
        api.getEvidence(`learnerId=${currentUser.id}&limit=100`).catch(() => []),
      ]);
      setProfile(prof);
      setEvidenceList(Array.isArray(evs) ? evs : (evs as any)?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load learning progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const skills = profile?.skills || [];
  const observedSkills = skills.filter((skill: any) => skill.scorePercentage !== null);
  const latestPoint = profile?.progression?.[profile.progression.length - 1];

  return (
    <AppShell
      currentPath="/student/progress"
      userName={user?.name || 'Student'}
      userRole="Student"
      roleMode="STUDENT"
    >
      <div className="space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-[#082051]">My Progress</h1>
          <p className="text-sm text-[#656C79] mt-1">
            Your progress is based on completed checkpoints and teacher-reviewed evidence.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#656C79]">Loading progress...</div>
        ) : error ? (
          <div className="p-6 max-w-xl mx-auto">
            <ErrorState title="Unable to load your progress" message={error} onRetry={loadData} />
          </div>
        ) : profile?.totalEvidenceCount === 0 ? (
          <EmptyState
            title="Your progress will appear here"
            description="Complete an assessment to start building evidence for your English skills."
            action={<a className="text-sm font-semibold text-[#0967F7] hover:underline" href="/student/assessments">View my assessments</a>}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#656C79]"><BarChart3 className="w-4 h-4 text-[#0967F7]" /> Overall proficiency</div>
                <p className="text-3xl font-bold text-[#082051]">{profile?.overallProficiency ?? '—'}{profile?.overallProficiency != null ? '%' : ''}</p>
                <p className="text-xs text-[#656C79]">Based on {profile.totalEvidenceCount} recorded observation{profile.totalEvidenceCount === 1 ? '' : 's'}.</p>
              </Card>
              <Card className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#656C79]"><TrendingUp className="w-4 h-4 text-emerald-600" /> Evidence confidence</div>
                <p className="text-3xl font-bold text-[#082051]">{profile?.overallConfidence || 'NO_DATA'}</p>
                <p className="text-xs text-[#656C79]">{Math.round((profile?.skillsCoverageRatio || 0) * 100)}% of tracked skills have evidence.</p>
              </Card>
              <Card className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#656C79]"><Target className="w-4 h-4 text-amber-600" /> Current focus</div>
                <p className="text-base font-bold text-[#082051] leading-snug">{profile?.currentFocus || 'Complete a checkpoint to find a focus.'}</p>
                {latestPoint && <p className="text-xs text-[#656C79]">Latest evidence: {latestPoint.label}</p>}
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#082051]">Skill breakdown</h2>
                  <p className="text-xs text-[#656C79] mt-1">Scores reflect observed work, not a permanent grade.</p>
                </div>
                <Badge variant="primary">{observedSkills.length} observed</Badge>
              </div>
              <div className="space-y-5">
                {skills.map((skill: any) => {
                  const score = skill.scorePercentage;
                  return (
                    <div key={skill.skillId}>
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-[#082051]">{skill.skillName}</p>
                          <p className="text-xs text-[#656C79]">{skill.skillArea}</p>
                        </div>
                        <span className="text-xs font-semibold text-[#5969AB]">{score === null ? 'Not observed yet' : `${score}% · ${skill.confidence}`}</span>
                      </div>
                      <ProgressBar value={score ?? 0} size="sm" color={scoreColor(score)} />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Evidence History Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#082051]">Evidence History</h2>
                  <p className="text-xs text-[#656C79] mt-1">
                    Traceable observations derived from your assessment submissions.
                  </p>
                </div>
                <Badge variant="default">{evidenceList.length} records</Badge>
              </div>

              {evidenceList.length > 0 ? (
                <div className="divide-y divide-gray-100 text-xs">
                  {evidenceList.map((ev: any) => (
                    <div key={ev.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-[#082051]">
                            {ev.skillName || 'Skill Observation'}
                          </span>
                          <span className="text-[10px] bg-blue-50 text-[#0967F7] px-2 py-0.5 rounded font-semibold">
                            {ev.difficulty || 'MEDIUM'}
                          </span>
                          <span className="text-[10px] text-[#656C79]">
                            {ev.evaluatorType === 'AUTO' ? 'Auto-graded' : 'Teacher-evaluated'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#656C79]">
                          {ev.assessmentTitle || 'Assessment Checkpoint'} •{' '}
                          {new Date(ev.observedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-[#0967F7]">
                          {Math.round(ev.normalizedScore * 100)}%
                        </div>
                        <span className="text-[10px] text-[#656C79]">
                          Weight: {ev.weight ?? 1.0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#656C79] py-4 text-center">
                  No individual evidence items found.
                </p>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
