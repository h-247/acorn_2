import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';

describe('Integrated thesis-defense demo seed data', () => {
  beforeAll(async () => {
    await seed();
    await seed();
  });

  it('has four parent skills with two direct child subskills each', async () => {
    const parents = [SEED_IDS.skillReading, SEED_IDS.skillListening, SEED_IDS.skillSpeaking, SEED_IDS.skillWriting];
    const rows = await db.select().from(schema.skills).where(eq(schema.skills.status, 'ACTIVE'));

    expect(rows.filter((skill) => skill.parentId === null).map((skill) => skill.id).sort()).toEqual([...parents].sort());
    for (const parentId of parents) expect(rows.filter((skill) => skill.parentId === parentId)).toHaveLength(2);
  });

  it('publishes one 10-minute integrated assessment to the specified class with a 3-3-2-2 skill distribution', async () => {
    const [assessment] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, SEED_IDS.assessmentIntegrated));
    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, SEED_IDS.assignmentIntegrated));
    const [learningClass] = await db.select().from(schema.classes).where(eq(schema.classes.id, SEED_IDS.classIeltsA));
    const items = await db.select().from(schema.assessmentItems).where(eq(schema.assessmentItems.assessmentId, SEED_IDS.assessmentIntegrated));
    const questionIds = items.map((item) => item.questionId);
    const questions = await db.select().from(schema.questions).where(inArray(schema.questions.id, questionIds));
    const links = await db.select().from(schema.questionSkills).where(inArray(schema.questionSkills.questionId, questionIds));

    expect(learningClass.name).toBe('IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)');
    expect(assessment.status).toBe('PUBLISHED');
    expect(assessment.timeLimitMinutes).toBe(10);
    expect(assignment).toMatchObject({ assessmentId: SEED_IDS.assessmentIntegrated, classId: SEED_IDS.classIeltsA, status: 'OPEN' });
    expect(items).toHaveLength(10);
    expect(questions.filter((question) => question.type === 'MCQ')).toHaveLength(3);
    expect(questions.filter((question) => question.type === 'LISTENING')).toHaveLength(3);
    expect(questions.filter((question) => question.type === 'SPEAKING')).toHaveLength(2);
    expect(questions.filter((question) => question.type === 'WRITING')).toHaveLength(2);

    const primaryLinks = links.filter((link) => link.role === 'PRIMARY');
    expect(primaryLinks.filter((link) => link.skillId === SEED_IDS.skillReadingMainIdea)).toHaveLength(3);
    expect(primaryLinks.filter((link) => link.skillId === SEED_IDS.skillListeningDetail)).toHaveLength(3);
    expect(primaryLinks.filter((link) => link.skillId === SEED_IDS.skillSpeakingFluency)).toHaveLength(2);
    expect(primaryLinks.filter((link) => link.skillId === SEED_IDS.skillWritingTaskResponse)).toHaveLength(2);
  });

  it('keeps Listening audio and approved materials for all selected subskills', async () => {
    const listeningQuestions = await db.select().from(schema.questions).where(and(eq(schema.questions.sourceMaterialId, SEED_IDS.matListeningCampus), eq(schema.questions.type, 'LISTENING')));
    expect(listeningQuestions).toHaveLength(3);

    const [audio] = await db.select().from(schema.materialFiles).where(and(eq(schema.materialFiles.materialId, SEED_IDS.matListeningCampus), eq(schema.materialFiles.mimeType, 'audio/mpeg')));
    expect(audio.fileKey).toBe('demo-rehearsal/listening/campus-library-orientation.mp3');

    const materials = await db.select().from(schema.materials).where(and(eq(schema.materials.status, 'APPROVED'), inArray(schema.materials.primarySkillId, [SEED_IDS.skillReadingMainIdea, SEED_IDS.skillListeningDetail, SEED_IDS.skillSpeakingFluency, SEED_IDS.skillWritingTaskResponse])));
    expect(new Set(materials.map((material) => material.primarySkillId))).toEqual(new Set([SEED_IDS.skillReadingMainIdea, SEED_IDS.skillListeningDetail, SEED_IDS.skillSpeakingFluency, SEED_IDS.skillWritingTaskResponse]));
  });
});

