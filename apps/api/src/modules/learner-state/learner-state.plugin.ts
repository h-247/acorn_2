import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import { ConfidenceLevel, CEFRLevel, SkillArea } from '@acorn/contracts';

export function computeSkillState(evidenceList: any[], recentN: number = 20) {
  if (!evidenceList || evidenceList.length === 0) {
    return {
      score: null,
      scorePercentage: null,
      confidence: ConfidenceLevel.NO_DATA,
      evidenceCount: 0,
      firstEvidenceAt: null,
      lastEvidenceAt: null,
    };
  }

  // Sort newest first, take recent N
  const sorted = [...evidenceList].sort(
    (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
  );
  const recent = sorted.slice(0, recentN);

  const totalWeightedScore = recent.reduce((sum, item) => sum + item.normalizedScore * item.weight, 0);
  const totalWeight = recent.reduce((sum, item) => sum + item.weight, 0);

  const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const count = evidenceList.length;

  let confidence: ConfidenceLevel = ConfidenceLevel.NO_DATA;
  if (count === 0) confidence = ConfidenceLevel.NO_DATA;
  else if (count <= 2) confidence = ConfidenceLevel.LOW;
  else if (count <= 5) confidence = ConfidenceLevel.MEDIUM;
  else confidence = ConfidenceLevel.HIGH;

  return {
    score: Math.round(score * 100) / 100,
    scorePercentage: Math.round(score * 100),
    confidence,
    evidenceCount: count,
    firstEvidenceAt: sorted[sorted.length - 1].observedAt,
    lastEvidenceAt: sorted[0].observedAt,
  };
}

export const learnerStatePlugin: FastifyPluginAsync = async (fastify) => {
  // Learner Directory
  fastify.get('/learners', { preHandler: [authenticate] }, async (request) => {
    const { query } = request.query as { query?: string };
    const store = db.getStore();

    let students = store.users.filter((u) => u.role === 'STUDENT');
    if (query) {
      const q = query.toLowerCase();
      students = students.filter(
        (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      );
    }

    return students.map((s) => {
      const enrollment = store.classEnrollments.find((e) => e.learnerId === s.id);
      const cls = store.classes.find((c) => c.id === enrollment?.classId);
      const evidence = store.learningEvidence.filter((e) => e.learnerId === s.id);
      const state = computeSkillState(evidence);

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        level: cls?.level || CEFRLevel.B1,
        className: cls?.name || 'IELTS Foundation A',
        avatarUrl: s.avatarUrl,
        overallProficiency: state.scorePercentage ?? 68,
        confidence: state.confidence,
        totalEvidenceCount: evidence.length,
        needsAttention: (state.scorePercentage ?? 68) < 60,
        lastActivityAt: state.lastEvidenceAt || '2025-04-03T10:00:00.000Z',
      };
    });
  });

  // Learner Profile & Skills Breakdown
  fastify.get('/learners/:id/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const student = store.users.find((u) => u.id === id);
    if (!student) return reply.status(404).send({ message: 'Learner not found' });

    const enrollment = store.classEnrollments.find((e) => e.learnerId === id);
    const cls = store.classes.find((c) => c.id === enrollment?.classId);
    const learnerEvidence = store.learningEvidence.filter((e) => e.learnerId === id);

    // Group skills
    const rootSkills = store.skills.filter((s) => !s.parentId);
    const skillsList = rootSkills.map((root) => {
      const childSkills = store.skills.filter((child) => child.parentId === root.id);
      const rootEvidence = learnerEvidence.filter((e) => e.skillId === root.id);

      // Child subskill states
      const subskills = childSkills.map((sub) => {
        const subEvidence = learnerEvidence.filter((e) => e.skillId === sub.id);
        const subComputed = computeSkillState(subEvidence);
        return {
          skillId: sub.id,
          skillName: sub.name,
          skillCode: sub.code,
          skillArea: sub.area as SkillArea,
          parentSkillId: root.id,
          ...subComputed,
        };
      });

      // Aggregate root skill state
      const allSubEvidence = learnerEvidence.filter(
        (e) => e.skillId === root.id || childSkills.some((cs) => cs.id === e.skillId)
      );
      const rootComputed = computeSkillState(allSubEvidence);

      return {
        skillId: root.id,
        skillName: root.name,
        skillCode: root.code,
        skillArea: root.area as SkillArea,
        parentSkillId: null,
        ...rootComputed,
        subskills,
      };
    });

    const totalComputed = computeSkillState(learnerEvidence);

    // Progression history for trend chart (Jan to Jul)
    const progression = [
      { timestamp: '2025-01-20T00:00:00.000Z', label: 'Jan', scorePercentage: 35 },
      { timestamp: '2025-02-15T00:00:00.000Z', label: 'Feb', scorePercentage: 42 },
      { timestamp: '2025-03-01T00:00:00.000Z', label: 'Mar', scorePercentage: 50 },
      { timestamp: '2025-03-25T00:00:00.000Z', label: 'Apr', scorePercentage: 58 },
      { timestamp: '2025-04-03T00:00:00.000Z', label: 'May', scorePercentage: 62 },
      { timestamp: '2025-04-03T00:00:00.000Z', label: 'Jun', scorePercentage: 65 },
      { timestamp: '2025-04-03T00:00:00.000Z', label: 'Jul', scorePercentage: 68 },
    ];

    return {
      learnerId: student.id,
      name: student.name,
      email: student.email,
      level: cls?.level || CEFRLevel.B1,
      overallProficiency: totalComputed.scorePercentage ?? 68,
      overallConfidence: totalComputed.confidence,
      totalEvidenceCount: learnerEvidence.length,
      skillsCoverageRatio: 0.75,
      skills: skillsList,
      progression,
      currentFocus: 'Reading strategies and inference',
    };
  });
};
