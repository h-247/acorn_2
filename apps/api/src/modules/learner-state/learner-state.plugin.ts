import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, desc, asc, inArray, ilike, or } from 'drizzle-orm';
import { authenticate, assertLearnerAccess } from '../../infrastructure/auth/auth.js';
import { ConfidenceLevel, CEFRLevel, SkillArea, UserRole } from '@acorn/contracts';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import { computeSkillState } from './learner-state.service.js';
export { computeSkillState } from './learner-state.service.js';

export const learnerStatePlugin: FastifyPluginAsync = async (fastify) => {
  // Learner Directory
  fastify.get('/learners', { preHandler: [authenticate] }, async (request) => {
    const user = request.user!;
    const { query } = request.query as { query?: string };

    let targetStudentIds: string[] | null = null;

    if (user.role === UserRole.STUDENT) {
      targetStudentIds = [user.id];
    } else if (user.role === UserRole.TEACHER) {
      // Find classes taught by teacher
      const teacherClasses = await db
        .select({ id: schema.classes.id })
        .from(schema.classes)
        .where(eq(schema.classes.teacherId, user.id));

      const classIds = teacherClasses.map((c) => c.id);
      if (classIds.length === 0) {
        return [];
      }

      const enrollments = await db
        .select({ learnerId: schema.classEnrollments.learnerId })
        .from(schema.classEnrollments)
        .where(inArray(schema.classEnrollments.classId, classIds));

      targetStudentIds = [...new Set(enrollments.map((e) => e.learnerId))];
      if (targetStudentIds.length === 0) {
        return [];
      }
    }

    // Query students
    const userConditions = [eq(schema.users.role, UserRole.STUDENT)];
    if (targetStudentIds) {
      userConditions.push(inArray(schema.users.id, targetStudentIds));
    }
    if (query) {
      const q = `%${query.trim()}%`;
      userConditions.push(or(ilike(schema.users.name, q), ilike(schema.users.email, q))!);
    }

    const students = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(and(...userConditions));

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);

    // Fetch enrollments with classes
    const enrollments = await db
      .select({
        learnerId: schema.classEnrollments.learnerId,
        classId: schema.classes.id,
        className: schema.classes.name,
        classLevel: schema.classes.level,
      })
      .from(schema.classEnrollments)
      .innerJoin(schema.classes, eq(schema.classEnrollments.classId, schema.classes.id))
      .where(inArray(schema.classEnrollments.learnerId, studentIds));

    const enrollmentMap = new Map(enrollments.map((e) => [e.learnerId, e]));

    // Fetch all evidence for these students
    const allEvidence = await db
      .select({
        learnerId: schema.learningEvidence.learnerId,
        normalizedScore: schema.learningEvidence.normalizedScore,
        weight: schema.learningEvidence.weight,
        observedAt: schema.learningEvidence.observedAt,
      })
      .from(schema.learningEvidence)
      .where(inArray(schema.learningEvidence.learnerId, studentIds))
      .orderBy(desc(schema.learningEvidence.observedAt));

    const evidenceByLearner = new Map<string, typeof allEvidence>();
    for (const ev of allEvidence) {
      const list = evidenceByLearner.get(ev.learnerId) || [];
      list.push(ev);
      evidenceByLearner.set(ev.learnerId, list);
    }

    return students.map((s) => {
      const enrollment = enrollmentMap.get(s.id);
      const studentEvidence = evidenceByLearner.get(s.id) || [];
      const state = computeSkillState(studentEvidence);

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        level: (enrollment?.classLevel as CEFRLevel) || CEFRLevel.B1,
        className: enrollment?.className || 'Unassigned Class',
        avatarUrl: s.avatarUrl,
        overallProficiency: state.scorePercentage,
        confidence: state.confidence,
        totalEvidenceCount: studentEvidence.length,
        needsAttention: state.scorePercentage !== null && state.scorePercentage < 60,
        lastActivityAt: state.lastEvidenceAt,
      };
    });
  });

  // Learner Profile & Skills Breakdown
  fastify.get('/learners/:id/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    await assertLearnerAccess(user, id);

    const [student] = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(and(eq(schema.users.id, id), eq(schema.users.role, UserRole.STUDENT)));

    if (!student) throw new NotFoundError('Learner not found');

    const [enrollment] = await db
      .select({
        classId: schema.classes.id,
        className: schema.classes.name,
        classLevel: schema.classes.level,
      })
      .from(schema.classEnrollments)
      .innerJoin(schema.classes, eq(schema.classEnrollments.classId, schema.classes.id))
      .where(eq(schema.classEnrollments.learnerId, id));

    // Fetch all skills
    const allSkills = await db
      .select()
      .from(schema.skills)
      .orderBy(asc(schema.skills.code));

    // Fetch all evidence for this learner
    const learnerEvidence = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.learnerId, id))
      .orderBy(asc(schema.learningEvidence.observedAt));

    // Group skills hierarchy
    const rootSkills = allSkills.filter((s) => !s.parentId);
    let skillsWithEvidenceCount = 0;

    const skillsList = rootSkills.map((root) => {
      const childSkills = allSkills.filter((child) => child.parentId === root.id);

      // Child subskill states
      const subskills = childSkills.map((sub) => {
        const subEvidence = learnerEvidence.filter((e) => e.skillId === sub.id);
        if (subEvidence.length > 0) skillsWithEvidenceCount++;
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

      // Aggregate root skill state across root and children
      const allSubEvidence = learnerEvidence.filter(
        (e) => e.skillId === root.id || childSkills.some((cs) => cs.id === e.skillId)
      );
      if (learnerEvidence.some((e) => e.skillId === root.id)) {
        skillsWithEvidenceCount++;
      }
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

    const leafSkillsCount = allSkills.filter((s) => s.parentId).length || allSkills.length;
    const skillsCoverageRatio =
      allSkills.length > 0
        ? Math.round((skillsWithEvidenceCount / allSkills.length) * 100) / 100
        : 0;

    // Real progression points calculated from chronological evidence
    const progression: Array<{
      timestamp: string;
      label: string;
      scorePercentage: number;
      skillId?: string;
      skillName?: string;
    }> = [];

    if (learnerEvidence.length > 0) {
      let cumulativeWeighted = 0;
      let cumulativeWeight = 0;

      // Sample or group by observation
      for (const ev of learnerEvidence) {
        cumulativeWeighted += ev.normalizedScore * (ev.weight ?? 1.0);
        cumulativeWeight += (ev.weight ?? 1.0);
        const runningScore = cumulativeWeight > 0 ? cumulativeWeighted / cumulativeWeight : 0;

        const date = new Date(ev.observedAt);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const skill = allSkills.find((s) => s.id === ev.skillId);

        progression.push({
          timestamp: date.toISOString(),
          label,
          scorePercentage: Math.round(runningScore * 100),
          skillId: ev.skillId,
          skillName: skill?.name,
        });
      }
    }

    // Identify current focus: skill with lowest score that has evidence, or first unmastered skill
    let weakestSkill = allSkills[0];
    let minScore = Infinity;
    for (const root of skillsList) {
      if (root.scorePercentage !== null && root.scorePercentage < minScore) {
        minScore = root.scorePercentage;
        weakestSkill = allSkills.find((s) => s.id === root.skillId) || weakestSkill;
      }
      for (const sub of root.subskills || []) {
        if (sub.scorePercentage !== null && sub.scorePercentage < minScore) {
          minScore = sub.scorePercentage;
          weakestSkill = allSkills.find((s) => s.id === sub.skillId) || weakestSkill;
        }
      }
    }

    const currentFocus = `${weakestSkill?.name || 'General English'} mastery practice`;

    return {
      learnerId: student.id,
      name: student.name,
      email: student.email,
      level: (enrollment?.classLevel as CEFRLevel) || CEFRLevel.B1,
      overallProficiency: totalComputed.scorePercentage,
      overallConfidence: totalComputed.confidence,
      totalEvidenceCount: learnerEvidence.length,
      skillsCoverageRatio,
      skills: skillsList,
      progression,
      currentFocus,
    };
  });
};
