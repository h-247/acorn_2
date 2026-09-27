import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';

describe('Four-skill thesis-defense seed data', () => {
  beforeAll(async () => {
    await seed();
    await seed();
  });

  it('provides a published assessment and open assignment for each mandatory skill', async () => {
    const assessmentIds = [
      SEED_IDS.assessmentReading03,
      SEED_IDS.assessmentWriting01,
      SEED_IDS.assessmentSpeaking01,
      SEED_IDS.assessmentListening01,
    ];

    const assessments = await db.select().from(schema.assessments);
    expect(assessments.filter((assessment) => assessmentIds.includes(assessment.id))).toHaveLength(4);
    expect(assessments.filter((assessment) => assessmentIds.includes(assessment.id)).every((assessment) => assessment.status === 'PUBLISHED')).toBe(true);

    const assignments = await db.select().from(schema.assignments);
    expect(assignments.filter((assignment) => assessmentIds.includes(assignment.assessmentId) && assignment.status === 'OPEN')).toHaveLength(4);
  });

  it('provides evaluated, awaiting-review, and autosaved rehearsal states without duplicated evidence', async () => {
    const submissions = await db.select().from(schema.submissions);
    expect(submissions.find((submission) => submission.id === SEED_IDS.submissionEmmaWriting)?.status).toBe('EVALUATED');
    expect(submissions.find((submission) => submission.id === SEED_IDS.submissionSofiaSpeaking)?.status).toBe('EVALUATED');
    expect(submissions.find((submission) => submission.id === SEED_IDS.submissionNoahListening)?.status).toBe('EVALUATED');
    expect(submissions.find((submission) => submission.id === SEED_IDS.submissionLiamWriting)?.status).toBe('SUBMITTED');
    expect(submissions.find((submission) => submission.id === SEED_IDS.submissionLucasListening)?.status).toBe('STARTED');

    const liveEvidence = await db.select().from(schema.learningEvidence).where(eq(schema.learningEvidence.isSuperseded, false));
    for (const submissionId of [SEED_IDS.submissionEmmaWriting, SEED_IDS.submissionSofiaSpeaking, SEED_IDS.submissionNoahListening]) {
      expect(liveEvidence.filter((evidence) => evidence.submissionId === submissionId)).toHaveLength(1);
    }
  });

  it('links Listening question readiness metadata to its deterministic audio file row', async () => {
    const [question] = await db.select().from(schema.questions).where(eq(schema.questions.id, SEED_IDS.qListeningLibraryHours));
    expect(question.type).toBe('LISTENING');
    expect(question.sourceMaterialId).toBe(SEED_IDS.matListeningCampus);

    const [audio] = await db.select().from(schema.materialFiles).where(and(
      eq(schema.materialFiles.materialId, SEED_IDS.matListeningCampus),
      eq(schema.materialFiles.mimeType, 'audio/mpeg'),
    ));
    expect(audio.fileKey).toBe('demo-rehearsal/listening/campus-library-orientation.mp3');
    expect(audio.fileSize).toBe(0);
  });
});

