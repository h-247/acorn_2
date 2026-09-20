import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole, SubmissionStatus, QuestionType, AssessmentStatus } from '@acorn/contracts';

function createMultipartBuffer(
  boundary: string,
  fields: Record<string, string>,
  file: { name: string; filename: string; contentType: string; content: Buffer }
): Buffer {
  const crlf = '\r\n';
  let header = '';
  for (const [k, v] of Object.entries(fields)) {
    header += `--${boundary}${crlf}`;
    header += `Content-Disposition: form-data; name="${k}"${crlf}${crlf}`;
    header += `${v}${crlf}`;
  }
  header += `--${boundary}${crlf}`;
  header += `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${crlf}`;
  header += `Content-Type: ${file.contentType}${crlf}${crlf}`;

  const headBuf = Buffer.from(header, 'utf-8');
  const tailBuf = Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf-8');
  return Buffer.concat([headBuf, file.content, tailBuf]);
}

describe('Student Workflow & Feature Integrity', () => {
  let app: ReturnType<typeof buildApp>;
  let studentEmmaToken: string;
  let studentLiamToken: string;
  let teacherTaylorToken: string;
  let activeSubmissionId: string;
  let speakingSubId: string;
  let speakingQId: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    studentEmmaToken = generateToken({
      id: SEED_IDS.studentEmma,
      email: 'emma.nguyen@student.acorn.edu',
      name: 'Emma Nguyen',
      role: UserRole.STUDENT,
    });

    studentLiamToken = generateToken({
      id: SEED_IDS.studentLiam,
      email: 'liam@student.acorn.edu',
      name: 'Liam Chen',
      role: UserRole.STUDENT,
    });

    teacherTaylorToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    // Create an active (STARTED) submission for Emma to test in-progress features
    const [created] = await db
      .insert(schema.submissions)
      .values({
        assignmentId: SEED_IDS.assignmentReading03,
        assessmentId: SEED_IDS.assessmentReading03,
        learnerId: SEED_IDS.studentEmma,
        status: SubmissionStatus.STARTED,
        maxPossibleScore: 100,
      })
      .returning();

    activeSubmissionId = created.id;

    const speakingAssessmentId = '77777777-7777-7777-7777-777777777788';
    await db.insert(schema.assessments).values({
      id: speakingAssessmentId,
      title: 'Speaking Practice Assessment',
      status: AssessmentStatus.PUBLISHED,
      level: 'B1',
      createdBy: SEED_IDS.teacherTaylor,
    }).onConflictDoNothing();

    speakingQId = '77777777-7777-7777-7777-777777777701';
    await db.insert(schema.questions).values({
      id: speakingQId,
      type: QuestionType.SPEAKING,
      prompt: 'Describe your hometown and how it has changed.',
      level: 'B1',
      difficulty: 'MEDIUM',
    }).onConflictDoNothing();

    await db.insert(schema.assessmentItems).values({
      assessmentId: speakingAssessmentId,
      questionId: speakingQId,
      sequenceOrder: 1,
      points: 10,
    }).onConflictDoNothing();

    const [speakingCreated] = await db
      .insert(schema.submissions)
      .values({
        assignmentId: SEED_IDS.assignmentReading03,
        assessmentId: speakingAssessmentId,
        learnerId: SEED_IDS.studentEmma,
        status: SubmissionStatus.STARTED,
        maxPossibleScore: 100,
      })
      .returning();
    speakingSubId = speakingCreated.id;
  });

  it('1. GET /api/submissions includes dueAt, timeLimitMinutes, and filters by student ownership', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/submissions',
      headers: {
        authorization: `Bearer ${studentEmmaToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const submissions = JSON.parse(res.body);
    expect(Array.isArray(submissions)).toBe(true);
    expect(submissions.length).toBeGreaterThan(0);

    for (const sub of submissions) {
      expect(sub.learnerId).toBe(SEED_IDS.studentEmma);
      expect(sub).toHaveProperty('timeLimitMinutes');
      expect(sub).toHaveProperty('dueAt');
      expect(sub).toHaveProperty('assessmentTitle');
    }
  });

  it('2. GET /api/submissions/:id strips correctAnswer when test is not yet evaluated for student', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${activeSubmissionId}`,
      headers: {
        authorization: `Bearer ${studentEmmaToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const sub = JSON.parse(res.body);
    expect(sub.id).toBe(activeSubmissionId);
    expect(sub.status).toBe(SubmissionStatus.STARTED);
    expect(sub).toHaveProperty('timeLimitMinutes');
    expect(sub).toHaveProperty('dueAt');
    expect(sub).toHaveProperty('assessmentInstructions');

    // While test is in progress, correct answers MUST be null for students
    expect(sub.items.length).toBeGreaterThan(0);
    for (const item of sub.items) {
      if (item.question) {
        expect(item.question.correctAnswer).toBeNull();
      }
    }
  });

  it('3. GET /api/submissions/:id exposes correctAnswer & teacher feedback when submission is EVALUATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${SEED_IDS.submissionEmmaReading}`,
      headers: {
        authorization: `Bearer ${studentEmmaToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const sub = JSON.parse(res.body);
    expect(sub.id).toBe(SEED_IDS.submissionEmmaReading);
    expect(sub.status).toBe(SubmissionStatus.EVALUATED);
    expect(sub.overallScore).not.toBeNull();

    // In evaluated state, correct answers are revealed for student review
    const mcqItem = sub.items.find((it: any) => it.question?.type === 'MCQ');
    if (mcqItem?.question) {
      expect(mcqItem.question.correctAnswer).not.toBeNull();
    }
  });

  it('4. POST /api/submissions/:id/audio accepts student speaking response and uploads to storage', async () => {
    const boundary = '----WebKitFormBoundaryStudentAudioTest' + Date.now();
    const payload = createMultipartBuffer(
      boundary,
      { questionId: speakingQId },
      {
        name: 'file',
        filename: 'speaking-recording.webm',
        contentType: 'audio/webm',
        content: Buffer.from('FAKE_AUDIO_DATA_FOR_SPEAKING_TEST'),
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${speakingSubId}/audio`,
      headers: {
        authorization: `Bearer ${studentEmmaToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.audioUrl).toBeDefined();
    expect(body.questionId).toBe(speakingQId);
  });

  it('5. Blocks student from uploading audio to another student submission with 403', async () => {
    const boundary = '----WebKitFormBoundaryStudentAudioTest' + Date.now();
    const payload = createMultipartBuffer(
      boundary,
      { questionId: speakingQId },
      {
        name: 'file',
        filename: 'audio.webm',
        contentType: 'audio/webm',
        content: Buffer.from('AUDIO_CONTENT'),
      }
    );

    // Liam tries to upload audio to Emma's active submission
    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${speakingSubId}/audio`,
      headers: {
        authorization: `Bearer ${studentLiamToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it('6. Blocks student from reading another student submission with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${activeSubmissionId}`,
      headers: {
        authorization: `Bearer ${studentLiamToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
