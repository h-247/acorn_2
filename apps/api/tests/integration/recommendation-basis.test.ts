import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { config } from '../../src/shared/config.js';
import { UserRole } from '@acorn/contracts';

/**
 * G15: a recommendation has to describe the evidence it was built from.
 *
 * It used to take the lowest-scoring skill with any evidence and write "lower
 * than target mastery" whatever the number was, so a learner at 100% was told
 * they were behind. It also read the CEFR level off the skill rather than off
 * the class, and every seeded skill carries B1 - so the level was the same for
 * everyone regardless of what they were studying.
 */
describe('Recommendation states its basis truthfully', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();
    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });
  });

  /** Clear the learner's evidence and recommendations for a clean branch test. */
  async function reset() {
    await db
      .delete(schema.recommendationCandidates)
      .where(eq(schema.recommendationCandidates.recommendationId, schema.recommendationCandidates.recommendationId));
    await db.delete(schema.teacherDecisions);
    await db.delete(schema.recommendations);
    await db
      .delete(schema.learningEvidence)
      .where(eq(schema.learningEvidence.learnerId, SEED_IDS.studentEmma));
  }

  /** Give the learner N observations on one skill, all at the same score. */
  async function giveEvidence(skillId: string, score: number, count = 4) {
    for (let i = 0; i < count; i++) {
      await db.insert(schema.learningEvidence).values({
        learnerId: SEED_IDS.studentEmma,
        skillId,
        evidenceType: 'TEACHER_EVALUATION',
        evaluatorType: 'TEACHER',
        normalizedScore: score,
        difficulty: 'MEDIUM',
        weight: 1,
        observedAt: new Date(Date.now() - i * 86400000),
      });
    }
  }

  const fetchRecommendation = async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  beforeEach(reset);

  it('calls a skill below target exactly that, and quotes the numbers', async () => {
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 0.25);

    const rec = await fetchRecommendation();
    expect(rec.rationale.basis).toBe('BELOW_TARGET');
    expect(rec.targetSkillId).toBe(SEED_IDS.skillReadingMainIdea);

    const opening = rec.rationale.texts[0];
    expect(opening).toContain('25%');
    expect(opening).toContain(`${Math.round(config.masteryTarget * 100)}%`);
    expect(opening.toLowerCase()).toContain('below');
  });

  it('never claims a learner meeting the target is behind', async () => {
    // Every measured skill at full marks. Previously this still produced
    // "lower than target mastery" for whichever skill happened to be lowest.
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 1.0);
    await giveEvidence(SEED_IDS.skillReadingDetail, 1.0);

    const rec = await fetchRecommendation();
    expect(rec.rationale.basis).not.toBe('BELOW_TARGET');
    expect(rec.rationale.texts.join(' ').toLowerCase()).not.toContain('below the');
    expect(rec.priority).not.toBe('HIGH');
  });

  it('prefers an untested skill over one that already meets the target', async () => {
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 1.0);

    const rec = await fetchRecommendation();
    expect(rec.rationale.basis).toBe('NO_DATA');
    expect(rec.targetSkillId).not.toBe(SEED_IDS.skillReadingMainIdea);
    expect(rec.evidenceBasisCount).toBe(0);

    // An absence of evidence is not a weak result, and the wording must not
    // turn one into the other.
    expect(rec.rationale.texts[0].toLowerCase()).toContain('no evidence');
  });

  it('takes the CEFR level from the class, not from the skill', async () => {
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 0.25);

    const [cls] = await db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.id, SEED_IDS.classIeltsA));

    const rec = await fetchRecommendation();
    expect(rec.targetLevel).toBe(cls.level);
    expect(rec.rationale.texts[1]).toContain(cls.level);
  });

  it('records the target it was measured against', async () => {
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 0.25);

    const rec = await fetchRecommendation();
    expect(rec.rationale.masteryTarget).toBe(config.masteryTarget);
    expect(rec.rationale.grounding.basis).toBe(rec.rationale.basis);
    expect(rec.rationale.grounding.evidenceIds.length).toBeGreaterThan(0);
  });

  it('keeps a stored recommendation and its decision consistent', async () => {
    await giveEvidence(SEED_IDS.skillReadingMainIdea, 0.25);
    const rec = await fetchRecommendation();

    const [stored] = await db
      .select()
      .from(schema.recommendations)
      .where(
        and(
          eq(schema.recommendations.id, rec.id),
          eq(schema.recommendations.learnerId, SEED_IDS.studentEmma)
        )
      );

    expect(stored.targetLevel).toBe(rec.targetLevel);
    expect(stored.decisionStatus).toBe('PENDING');
  });
});
