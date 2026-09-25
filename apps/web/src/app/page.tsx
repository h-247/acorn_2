'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppShell,
  MetricCard,
  Card,
  Button,
  DistributionChart,
  StatusBadge,
  Badge,
  ErrorState,
} from '@acorn/ui';
import { FileText, Sparkles, AlertCircle, Edit3, ArrowRight, BookOpen, Clock, Users } from 'lucide-react';
import { api, setStoredUser } from '@/lib/api';

export default function TeacherHomePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Use /me as authority; never silently accept cached identity after failure
      let me: any = null;
      try {
        me = await api.getMe();
        setCurrentUser(me);
      } catch (authErr: any) {
        setStoredUser(null);
        setCurrentUser(null);
        const msg = authErr.message || '';
        if (msg.includes('Authentication required') || msg.includes('UNAUTHORIZED') || msg.includes('expired') || msg.includes('401')) {
          window.location.href = '/sign-in';
          return;
        }
        throw authErr;
      }

      const [clsList, met, subs, assess, mats, evList] = await Promise.all([
        api.getClasses(),
        api.getMetrics(),
        api.getSubmissions(),
        api.getAssessments(),
        api.getMaterials(),
        api.getEvidence(),
      ]);

      setClasses(clsList || []);
      setMetrics(met || null);
      setSubmissions(subs || []);
      setAssessments(assess || []);
      setMaterials(mats || []);
      setEvidence(evList || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load teacher dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const pendingReviewCount = submissions.filter((s) => s.status === 'SUBMITTED').length;
  const draftAssessmentsCount = assessments.filter((a) => a.status === 'DRAFT').length;
  // Reported by the API rather than inferred here: total minus accepted also
  // counted the ones a teacher had already rejected, modified, or that had gone
  // stale, so the number only ever grew.
  const recommendationsToReview = metrics?.recommendationsPendingCount ?? 0;

  const teacherName = currentUser?.name || 'Teacher';

  // Derive real curriculum insight from persisted evidence
  const skillStatsMap = new Map<string, { skillId: string; name: string; sumWeightedScore: number; sumWeight: number; count: number }>();

  for (const ev of evidence) {
    if (!ev.skillName) continue;
    const existing = skillStatsMap.get(ev.skillId) || {
      skillId: ev.skillId,
      name: ev.skillName,
      sumWeightedScore: 0,
      sumWeight: 0,
      count: 0,
    };
    const weight = ev.weight ?? 1;
    existing.sumWeightedScore += (ev.normalizedScore ?? 0) * weight;
    existing.sumWeight += weight;
    existing.count += 1;
    skillStatsMap.set(ev.skillId, existing);
  }

  const computedSkills = Array.from(skillStatsMap.values())
    .map((s) => ({
      skillId: s.skillId,
      name: s.name,
      value: s.sumWeight > 0 ? Math.round((s.sumWeightedScore / s.sumWeight) * 100) : 0,
      count: s.count,
    }))
    .sort((a, b) => a.value - b.value);

  const hasCurriculumData = computedSkills.length > 0;
  const lowestSkill = hasCurriculumData ? computedSkills[0] : null;

  const insightItems = hasCurriculumData
    ? computedSkills.slice(0, 4).map((s, idx) => ({
        label: s.name,
        value: s.value,
        highlight: idx === 0 && s.value < 70,
      }))
    : [];

  return (
    <AppShell currentPath="/" userName={teacherName} userRole="Teacher" roleMode="TEACHER">
      {loading ? (
        <div className="p-12 text-center text-sm text-[#656C79]">Loading teacher dashboard...</div>
      ) : error ? (
        <div className="p-6">
          <ErrorState
            title="Unable to load teacher dashboard"
            message={error}
            onRetry={loadDashboard}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#082051] tracking-tight">Teacher Home</h1>
              <p className="text-sm text-[#656C79] mt-1">
                Welcome back, {teacherName}! Manage your English classes and track authoritative learner evidence.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/materials/new">
                <Button variant="outline" size="md">
                  + New Material
                </Button>
              </a>
              <a href="/assessments/builder">
                <Button variant="primary" size="md">
                  + Create Assessment
                </Button>
              </a>
            </div>
          </div>

          {/* Needs your attention */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#082051]">Needs your attention</h2>
              <a href="/submissions" className="text-xs font-semibold text-[#0967F7] hover:underline flex items-center gap-1">
                View all submissions <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a href="/submissions">
                <MetricCard
                  icon={<FileText className="w-5 h-5 text-red-500" />}
                  value={pendingReviewCount}
                  label="Submissions awaiting review"
                  onClick={() => {}}
                />
              </a>
              <a href="/learners">
                <MetricCard
                  icon={<Sparkles className="w-5 h-5 text-indigo-600" />}
                  value={recommendationsToReview}
                  label="Recommendations to review"
                  onClick={() => {}}
                />
              </a>
              <a href="/learners">
                <MetricCard
                  icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
                  value={classes.reduce((sum, c) => sum + (c.pendingSubmissionsCount || 0), 0)}
                  label="Pending queue items"
                  onClick={() => {}}
                />
              </a>
              <a href="/assessments">
                <MetricCard
                  icon={<Edit3 className="w-5 h-5 text-blue-500" />}
                  value={draftAssessmentsCount}
                  label="Draft assessments"
                  onClick={() => {}}
                />
              </a>
            </div>
          </div>

          {/* Active Classes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#082051]">Active classes ({classes.length})</h2>
              <a href="/classes" className="text-xs font-semibold text-[#0967F7] hover:underline flex items-center gap-1">
                View all classes <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {classes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {classes.map((cls) => (
                  <Card key={cls.id} hoverable className="p-5 flex flex-col justify-between border-gray-200/80">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-[#0967F7] bg-blue-50 px-2.5 py-1 rounded-md">
                          {cls.courseName || 'English'}
                        </span>
                        <span className="text-xs text-[#656C79]">
                          {cls.level} • {cls.learnerCount} learners
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#082051] mb-1">{cls.name}</h3>
                      <div className="text-xs text-[#656C79] space-y-1.5 mt-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-[#5969AB]" />
                          <span>
                            Next:{' '}
                            <strong>{cls.nextActivity || 'Review assigned skill checkpoints'}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#5969AB]" />
                          <span>
                            Active assignments: <strong>{cls.activeAssessmentsCount || 0}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                      <a href={`/classes/${cls.id}`} className="text-xs font-semibold text-[#0967F7] flex items-center gap-1">
                        Class workspace <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-xs text-[#656C79]">
                No active classes currently assigned to your teacher account.
              </Card>
            )}
          </div>

          {/* Split Section: Recent Work & Class Insight */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Work */}
            <Card className="p-5 border-gray-200/80">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#082051]">Curriculum Materials</h3>
                <a href="/materials" className="text-xs text-[#0967F7] hover:underline">
                  View all ({materials.length}) ›
                </a>
              </div>

              {materials.length > 0 ? (
                <div className="space-y-3">
                  {materials.slice(0, 3).map((mat) => (
                    <a
                      key={mat.id}
                      href={`/materials/${mat.id}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F3F6FC]/60 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0967F7] flex items-center justify-center font-bold text-xs">
                          DOC
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#082051]">{mat.title}</h4>
                          <p className="text-[11px] text-[#656C79]">
                            {mat.primarySkillName} • {mat.level} • {mat.source}
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-400 text-xs">›</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#656C79] border border-dashed border-gray-200 rounded-xl">
                  No curriculum materials created yet.
                </div>
              )}
            </Card>

            {/* Class Insight */}
            <Card className="p-5 border-gray-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasCurriculumData ? 'bg-[#0967F7]' : 'bg-gray-400'}`} />
                    <h3 className="text-base font-bold text-[#082051]">Curriculum Insight</h3>
                  </div>
                  <span className="text-xs text-[#656C79] bg-[#F3F6FC] px-2 py-0.5 rounded-md font-medium">
                    {hasCurriculumData ? 'Authoritative Evidence' : 'NO_DATA'}
                  </span>
                </div>

                {hasCurriculumData && lowestSkill ? (
                  <>
                    <h4 className="text-sm font-bold text-[#082051] mb-1">
                      Targeted Practice: {lowestSkill.name}
                    </h4>
                    <p className="text-xs text-[#656C79] leading-relaxed">
                      Recent assessment evidence indicates {lowestSkill.name.toLowerCase()} items have lower proficiency ({lowestSkill.value}%) across cohorts. Consider scheduling targeted practice.
                    </p>

                    <div className="my-4">
                      <DistributionChart items={insightItems} />
                    </div>
                  </>
                ) : (
                  <div className="my-6 p-6 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center">
                    <div className="text-xs font-bold text-[#082051] mb-1">NO_DATA</div>
                    <p className="text-xs text-[#656C79]">
                      No curriculum evidence recorded yet across your classes. As learners complete assessments, authoritative skill proficiency insights will appear here.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-3 border-t border-gray-100">
                <a href="/classes" className="flex-1">
                  <Button variant="primary" size="sm" className="w-full">
                    Inspect classes ›
                  </Button>
                </a>
                <a href="/materials/new" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Create practice materials
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
