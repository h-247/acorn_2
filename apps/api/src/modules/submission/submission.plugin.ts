import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import {
  SubmissionStatus,
  EvaluatorType,
  EvidenceType,
  ConfidenceLevel,
  SaveResponseRequestSchema,
  SubmitAssessmentRequestSchema,
  EvaluateSubmissionRequestSchema,
} from '@acorn/contracts';

export const submissionPlugin: FastifyPluginAsync = async (fastify) => {
  // Submission Inbox
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { status, learnerId } = request.query as { status?: string; learnerId?: string };
    const store = db.getStore();

    let result = store.submissions;
    if (status) {
      result = result.filter((s) => s.status === status);
    }
    if (learnerId) {
      result = result.filter((s) => s.learnerId === learnerId);
    }

    return result.map((sub) => {
      const assessment = store.assessments.find((a) => a.id === sub.assessmentId);
      const learner = store.users.find((u) => u.id === sub.learnerId);
      const responses = store.submissionResponses.filter((sr) => sr.submissionId === sub.id);

      return {
        ...sub,
        assessmentTitle: assessment?.title || 'Assessment',
        learnerName: learner?.name || 'Student',
        learnerLevel: assessment?.level || 'B1',
        responses,
      };
    });
  });

  // Submission Detail
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const sub = store.submissions.find((s) => s.id === id);
    if (!sub) return reply.status(404).send({ message: 'Submission not found' });

    const assessment = store.assessments.find((a) => a.id === sub.assessmentId);
    const learner = store.users.find((u) => u.id === sub.learnerId);
    const responses = store.submissionResponses.filter((sr) => sr.submissionId === sub.id);

    return {
      ...sub,
      assessmentTitle: assessment?.title || 'Assessment',
      learnerName: learner?.name || 'Student',
      learnerLevel: assessment?.level || 'B1',
      responses,
    };
  });

  // Autosave response
  fastify.post('/:id/autosave', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = SaveResponseRequestSchema.parse(request.body);
    const store = db.getStore();

    const sub = store.submissions.find((s) => s.id === id);
    if (!sub) return reply.status(404).send({ message: 'Submission not found' });

    let resp = store.submissionResponses.find(
      (r) => r.submissionId === id && r.questionId === body.questionId
    );

    const now = new Date().toISOString();
    if (resp) {
      resp.responsePayload = body.responsePayload;
      resp.updatedAt = now;
    } else {
      resp = {
        id: randomUUID(),
        submissionId: id,
        questionId: body.questionId,
        responsePayload: body.responsePayload,
        isCorrect: null,
        rawScore: null,
        normalizedScore: null,
        updatedAt: now,
      };
      store.submissionResponses.push(resp);
    }

    sub.status = SubmissionStatus.IN_PROGRESS;
    return { success: true, savedAt: now };
  });

  // Submit assessment attempt
  fastify.post('/:id/submit', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const sub = store.submissions.find((s) => s.id === id);
    if (!sub) return reply.status(404).send({ message: 'Submission not found' });

    const body = SubmitAssessmentRequestSchema.parse({
      ...((request.body as any) || {}),
      submissionId: id,
    });

    const now = new Date().toISOString();
    sub.status = SubmissionStatus.SUBMITTED;
    sub.submittedAt = now;

    // Persist/update answers and auto-grade MCQs
    let totalScore = 0;
    let autoGradableCount = 0;

    for (const ans of body.answers) {
      const question = store.questions.find((q) => q.id === ans.questionId);
      let isCorrect: boolean | null = null;
      let normalizedScore: number | null = null;

      if (question?.type === 'MCQ' && question.correctAnswer) {
        autoGradableCount++;
        isCorrect = String(ans.responsePayload).trim() === question.correctAnswer.trim();
        normalizedScore = isCorrect ? 1.0 : 0.0;
        if (isCorrect) totalScore += 25;
      }

      let resp = store.submissionResponses.find(
        (r) => r.submissionId === id && r.questionId === ans.questionId
      );
      if (resp) {
        resp.responsePayload = ans.responsePayload;
        resp.isCorrect = isCorrect;
        resp.normalizedScore = normalizedScore;
        resp.updatedAt = now;
      } else {
        store.submissionResponses.push({
          id: randomUUID(),
          submissionId: id,
          questionId: ans.questionId,
          responsePayload: ans.responsePayload,
          isCorrect,
          rawScore: isCorrect ? 1 : 0,
          normalizedScore,
          updatedAt: now,
        });
      }
    }

    // If all questions are auto-gradable, finalize immediately
    const assessmentItems = store.assessmentItems.filter((ai) => ai.assessmentId === sub.assessmentId);
    if (autoGradableCount === assessmentItems.length && autoGradableCount > 0) {
      sub.status = SubmissionStatus.EVALUATED;
      sub.evaluatedAt = now;
      sub.evaluatorType = EvaluatorType.AUTO;
      sub.overallScore = totalScore;

      // Ingest Evidence for each question response
      for (const resp of store.submissionResponses.filter((r) => r.submissionId === id)) {
        const q = store.questions.find((quest) => quest.id === resp.questionId);
        const qSkills = store.questionSkills.filter((qs) => qs.questionId === resp.questionId);

        for (const qs of qSkills) {
          const skill = store.skills.find((s) => s.id === qs.skillId);
          store.learningEvidence.push({
            id: randomUUID(),
            learnerId: sub.learnerId,
            skillId: qs.skillId,
            questionId: resp.questionId,
            assessmentId: sub.assessmentId,
            submissionId: sub.id,
            evidenceType: EvidenceType.QUESTION_RESULT,
            evaluatorType: EvaluatorType.AUTO,
            observedValue: String(resp.responsePayload),
            normalizedScore: resp.normalizedScore ?? 0,
            difficulty: q?.difficulty || 'MEDIUM',
            weight: qs.weight || 1.0,
            observedAt: now,
            isCorrected: false,
            correctionNotes: null,
            sourceMaterialId: q?.sourceMaterialId || null,
          });
        }
      }
    }

    return sub;
  });

  // Evaluate submission (teacher rubric and feedback)
  fastify.post('/:id/evaluate', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const sub = store.submissions.find((s) => s.id === id);
    if (!sub) return reply.status(404).send({ message: 'Submission not found' });

    const body = EvaluateSubmissionRequestSchema.parse({
      ...((request.body as any) || {}),
      submissionId: id,
    });

    const now = new Date().toISOString();
    sub.status = SubmissionStatus.EVALUATED;
    sub.evaluatedAt = now;
    sub.evaluatorId = request.user?.id || store.users[0].id;
    sub.evaluatorType = EvaluatorType.AI_PLUS_TEACHER;
    sub.teacherFeedback = body.overallTeacherFeedback;

    let totalRaw = 0;
    let totalMax = 0;

    for (const r of body.responses) {
      const resp = store.submissionResponses.find(
        (sr) => sr.submissionId === id && sr.questionId === r.questionId
      );
      const normScore = Math.min(1.0, Math.max(0, r.rawScore / r.maxScore));
      totalRaw += r.rawScore;
      totalMax += r.maxScore;

      if (resp) {
        resp.isCorrect = r.isCorrect ?? normScore >= 0.7;
        resp.rawScore = r.rawScore;
        resp.normalizedScore = normScore;
        resp.teacherFeedback = r.teacherFeedback;
        resp.rubricScores = r.rubricScores;
        resp.updatedAt = now;
      }

      // Generate Evidence
      const q = store.questions.find((quest) => quest.id === r.questionId);
      const qSkills = store.questionSkills.filter((qs) => qs.questionId === r.questionId);

      for (const qs of qSkills) {
        store.learningEvidence.push({
          id: randomUUID(),
          learnerId: sub.learnerId,
          skillId: qs.skillId,
          questionId: r.questionId,
          assessmentId: sub.assessmentId,
          submissionId: sub.id,
          evidenceType: EvidenceType.RUBRIC_RESULT,
          evaluatorType: EvaluatorType.AI_PLUS_TEACHER,
          observedValue: JSON.stringify(r.rubricScores || r.rawScore),
          normalizedScore: normScore,
          difficulty: q?.difficulty || 'MEDIUM',
          weight: qs.weight || 1.0,
          observedAt: now,
          isCorrected: false,
          correctionNotes: null,
          sourceMaterialId: q?.sourceMaterialId || null,
        });
      }
    }

    sub.overallScore = totalMax > 0 ? Math.round((totalRaw / totalMax) * 100) : 75;

    // Audit Event
    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: sub.id,
      metadata: { overallScore: sub.overallScore },
      timestamp: now,
    });

    return sub;
  });
};
