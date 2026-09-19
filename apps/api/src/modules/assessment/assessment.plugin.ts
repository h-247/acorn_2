import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import {
  CreateQuestionRequestSchema,
  CreateAssessmentRequestSchema,
  AssignAssessmentRequestSchema,
  AssessmentStatus,
} from '@acorn/contracts';

export const assessmentPlugin: FastifyPluginAsync = async (fastify) => {
  // Questions Bank
  fastify.get('/questions', { preHandler: [authenticate] }, async (request) => {
    const { query, skillId, level, difficulty, type } = request.query as {
      query?: string;
      skillId?: string;
      level?: string;
      difficulty?: string;
      type?: string;
    };
    const store = db.getStore();

    let result = store.questions;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((item) => item.prompt.toLowerCase().includes(q));
    }
    if (level) {
      result = result.filter((item) => item.level === level);
    }
    if (difficulty) {
      result = result.filter((item) => item.difficulty === difficulty);
    }
    if (type) {
      result = result.filter((item) => item.type === type);
    }

    return result.map((q) => {
      const qSkills = store.questionSkills
        .filter((qs) => qs.questionId === q.id)
        .map((qs) => {
          const s = store.skills.find((sk) => sk.id === qs.skillId);
          return {
            skillId: qs.skillId,
            skillName: s?.name || 'Skill',
            role: qs.role,
            weight: qs.weight,
          };
        });

      const sourceMat = store.materials.find((m) => m.id === q.sourceMaterialId);

      return {
        ...q,
        skills: qSkills,
        sourceMaterialTitle: sourceMat?.title,
      };
    });
  });

  fastify.get('/questions/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const q = store.questions.find((item) => item.id === id);
    if (!q) return reply.status(404).send({ message: 'Question not found' });

    const qSkills = store.questionSkills
      .filter((qs) => qs.questionId === q.id)
      .map((qs) => {
        const s = store.skills.find((sk) => sk.id === qs.skillId);
        return {
          skillId: qs.skillId,
          skillName: s?.name || 'Skill',
          role: qs.role,
          weight: qs.weight,
        };
      });

    return {
      ...q,
      skills: qSkills,
    };
  });

  fastify.post('/questions', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CreateQuestionRequestSchema.parse(request.body);
    const store = db.getStore();
    const now = new Date().toISOString();
    const questionId = randomUUID();

    const newQuestion = {
      id: questionId,
      type: body.type,
      prompt: body.prompt,
      passage: body.passage,
      options: body.options,
      correctAnswer: body.correctAnswer,
      rubric: body.rubric,
      difficulty: body.difficulty,
      level: body.level,
      sourceMaterialId: body.sourceMaterialId || null,
      usageCount: 0,
      createdAt: now,
    };
    store.questions.push(newQuestion);

    body.skills.forEach((s) => {
      store.questionSkills.push({
        id: randomUUID(),
        questionId,
        skillId: s.skillId,
        role: s.role || 'PRIMARY',
        weight: s.weight || 1.0,
      });
    });

    return reply.status(201).send(newQuestion);
  });

  // Assessments
  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const store = db.getStore();
    return store.assessments.map((a) => {
      const items = store.assessmentItems
        .filter((ai) => ai.assessmentId === a.id)
        .sort((x, y) => x.sequenceOrder - y.sequenceOrder)
        .map((ai) => {
          const q = store.questions.find((quest) => quest.id === ai.questionId);
          const qSkills = store.questionSkills
            .filter((qs) => qs.questionId === q?.id)
            .map((qs) => {
              const s = store.skills.find((sk) => sk.id === qs.skillId);
              return {
                skillId: qs.skillId,
                skillName: s?.name || 'Skill',
                role: qs.role,
                weight: qs.weight,
              };
            });
          return {
            ...ai,
            question: {
              ...(q || {}),
              skills: qSkills,
            },
          };
        });

      return {
        ...a,
        items,
        totalPoints: items.reduce((sum, it) => sum + (it.points || 1), 0),
        skillsCovered: ['Reading', 'Inference', 'Main Idea'],
      };
    });
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const a = store.assessments.find((item) => item.id === id);
    if (!a) return reply.status(404).send({ message: 'Assessment not found' });

    const items = store.assessmentItems
      .filter((ai) => ai.assessmentId === a.id)
      .sort((x, y) => x.sequenceOrder - y.sequenceOrder)
      .map((ai) => {
        const q = store.questions.find((quest) => quest.id === ai.questionId);
        const qSkills = store.questionSkills
          .filter((qs) => qs.questionId === q?.id)
          .map((qs) => {
            const s = store.skills.find((sk) => sk.id === qs.skillId);
            return {
              skillId: qs.skillId,
              skillName: s?.name || 'Skill',
              role: qs.role,
              weight: qs.weight,
            };
          });
        return {
          ...ai,
          question: {
            ...(q || {}),
            skills: qSkills,
          },
        };
      });

    return {
      ...a,
      items,
      totalPoints: items.reduce((sum, it) => sum + (it.points || 1), 0),
      skillsCovered: ['Reading', 'Inference', 'Main Idea'],
    };
  });

  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CreateAssessmentRequestSchema.parse(request.body);
    const store = db.getStore();
    const now = new Date().toISOString();
    const assessmentId = randomUUID();

    const newAssessment = {
      id: assessmentId,
      title: body.title,
      description: body.description,
      instructions: body.instructions,
      level: body.level,
      status: AssessmentStatus.DRAFT,
      timeLimitMinutes: body.timeLimitMinutes || 20,
      createdBy: request.user?.id || store.users[0].id,
      createdAt: now,
      updatedAt: now,
    };
    store.assessments.push(newAssessment);

    body.questionIds.forEach((qId, index) => {
      store.assessmentItems.push({
        id: randomUUID(),
        assessmentId,
        questionId: qId,
        sequenceOrder: index + 1,
        points: 1,
      });
    });

    return reply.status(201).send(newAssessment);
  });

  fastify.put('/:id/publish', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const a = store.assessments.find((item) => item.id === id);
    if (!a) return reply.status(404).send({ message: 'Assessment not found' });

    a.status = AssessmentStatus.PUBLISHED;
    a.updatedAt = new Date().toISOString();
    return a;
  });

  fastify.post('/:id/assign', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AssignAssessmentRequestSchema.parse({
      ...((request.body as any) || {}),
      assessmentId: id,
    });
    const store = db.getStore();
    const now = new Date().toISOString();

    const assignmentId = randomUUID();
    const assignment = {
      id: assignmentId,
      assessmentId: id,
      classId: body.classId || null,
      learnerId: body.learnerIds?.[0] || null,
      assignedAt: now,
      dueAt: body.dueAt || null,
      status: 'OPEN',
    };
    store.assignments.push(assignment);

    // If assigned to learners or class, create draft submissions for student player
    if (body.classId) {
      const enrollments = store.classEnrollments.filter((e) => e.classId === body.classId);
      enrollments.forEach((e) => {
        store.submissions.push({
          id: randomUUID(),
          assignmentId,
          assessmentId: id,
          learnerId: e.learnerId,
          status: 'STARTED',
          startedAt: now,
          submittedAt: null,
          evaluatedAt: null,
          evaluatorId: null,
          evaluatorType: 'AUTO',
          overallScore: null,
          maxPossibleScore: 100,
          teacherFeedback: undefined,
        });
      });
    }

    return reply.status(201).send(assignment);
  });
};
