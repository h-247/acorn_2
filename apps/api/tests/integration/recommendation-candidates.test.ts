import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole, MaterialStatus } from '@acorn/contracts';

/**
 * G15: the candidates a recommendation offers, and the decision a teacher makes.
 *
 * `docs/setup/local-development.md` states the rule - REUSE is an exact level
 * match, ADAPT is adjacent, NO_MATCH routes to manual creation - and the code
 * did none of it. It took the first skill-matching material whatever its level,
 * called the second one ADAPT, and when nothing matched the skill it attached
 * an unrelated material under a NO_MATCH label, so the one case meaning "there
 * is nothing here" looked like a suggestion with a real title and link.
 */
describe('Recommendation candidates and decisions', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let skillId: string;
  const learnerId = SEED_IDS.studentLiam;

  beforeAll(async () => {
    await seed();
    app = buildApp();
    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    // Liam has no evidence, so the engine takes the first untested skill by
    // code. Attach the library to that one, or the cases below describe a
    // skill nobody is being recommended.
    const [skill] = await db
      .select()
      .from(schema.skills)
      .orderBy(asc(schema.skills.code))
      .limit(1);
    skillId = skill.id;
  });

  const auth = () => ({ authorization: `Bearer ${teacherToken}` });

  /** Start from nothing: no recommendation, and a library we control. */
  const resetLibrary = async () => {
    const recs = await db
      .select({ id: schema.recommendations.id })
      .from(schema.recommendations)
      .where(eq(schema.recommendations.learnerId, learnerId));
    const recIds = recs.map((r) => r.id);

    if (recIds.length > 0) {
      await db
        .delete(schema.recommendationCandidates)
        .where(inArray(schema.recommendationCandidates.recommendationId, recIds));
      await db
        .delete(schema.teacherDecisions)
        .where(inArray(schema.teacherDecisions.recommendationId, recIds));
      await db.delete(schema.recommendations).where(inArray(schema.recommendations.id, recIds));
    }

    // Take everything out of circulation for this learner's class, so each case
    // below decides for itself what the library holds.
    await db
      .delete(schema.classMaterials)
      .where(eq(schema.classMaterials.classId, SEED_IDS.classIeltsA));
  };

  /** Put one material in the library and release it to the learner's class. */
  const release = async (title: string, level: string) => {
    const [mat] = await db
      .insert(schema.materials)
      .values({
        title,
        type: 'ARTICLE',
        primarySkillId: skillId,
        level,
        source: 'MANUAL',
        status: MaterialStatus.APPROVED,
        estimatedMinutes: 12,
      })
      .returning();

    await db.insert(schema.classMaterials).values({
      classId: SEED_IDS.classIeltsA,
      materialId: mat.id,
      releasedBy: SEED_IDS.teacherTaylor,
    });

    return mat;
  };

  const fetchRecommendation = async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${learnerId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  beforeEach(resetLibrary);

  // ── which materials get offered ──────────────────────────────────────────

  it('offers an exact level match for reuse', async () => {
    // The class sits at B1, so a B1 passage is usable as it stands.
    await release('B1 inference practice', 'B1');

    const rec = await fetchRecommendation();
    const reuse = rec.candidates.find((c: any) => c.action === 'REUSE');

    expect(reuse).toBeDefined();
    expect(reuse.level).toBe('B1');
    expect(reuse.matchReason).toContain('ready to use');
  });

  it('offers an adjacent level for adaptation', async () => {
    await release('B1 inference practice', 'B1');
    await release('B2 inference practice', 'B2');

    const rec = await fetchRecommendation();
    const actions = rec.candidates.map((c: any) => c.action);

    expect(actions).toContain('REUSE');
    expect(actions).toContain('ADAPT');

    const adapt = rec.candidates.find((c: any) => c.action === 'ADAPT');
    expect(adapt.level).toBe('B2');
    expect(adapt.matchReason).toContain('one level from B1');
  });

  it('will not call a two-level gap an adaptation', async () => {
    // C1 for a B1 learner is not an adaptation; it is the wrong passage.
    await release('C1 inference practice', 'C1');

    const rec = await fetchRecommendation();
    expect(rec.candidates.map((c: any) => c.action)).toEqual(['NO_MATCH']);
    expect(rec.candidates[0].matchReason).toContain('none at or next to B1');
  });

  it('attaches no material to a NO_MATCH card', async () => {
    const rec = await fetchRecommendation();
    const [candidate] = rec.candidates;

    expect(candidate.action).toBe('NO_MATCH');
    // It used to borrow an unrelated material's title, level and duration, so
    // the empty case read as a suggestion.
    expect(candidate.materialId).toBeNull();
    expect(candidate.title).toBeNull();
    expect(candidate.level).toBeNull();
  });

  it('still offers a card when the library is empty, so the teacher can act', async () => {
    const rec = await fetchRecommendation();
    // No candidates at all left the teacher with a recommendation and nothing
    // to do about it.
    expect(rec.candidates).toHaveLength(1);
    expect(rec.candidates[0].matchReason).toContain('Author new material');
  });

  // ── the decision ─────────────────────────────────────────────────────────

  const decide = (recId: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: `/api/recommendations/${recId}/decision`,
      headers: auth(),
      payload: { recommendationId: recId, ...payload },
    });

  it('refuses a material that this recommendation never offered', async () => {
    await release('B1 inference practice', 'B1');
    const rec = await fetchRecommendation();

    // A real material, approved and in the library - but not on this card.
    const outsider = await db
      .insert(schema.materials)
      .values({
        title: 'Unrelated listening drill',
        type: 'AUDIO',
        primarySkillId: skillId,
        level: 'B1',
        source: 'MANUAL',
        status: MaterialStatus.APPROVED,
      })
      .returning();

    const res = await decide(rec.id, {
      decision: 'ACCEPT',
      selectedMaterialId: outsider[0].id,
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('not one of the candidates');
  });

  it('accepts the candidate the teacher picked', async () => {
    await release('B1 inference practice', 'B1');
    await release('B2 inference practice', 'B2');
    const rec = await fetchRecommendation();

    const adapt = rec.candidates.find((c: any) => c.action === 'ADAPT');
    const res = await decide(rec.id, {
      decision: 'ACCEPT',
      selectedMaterialId: adapt.materialId,
    });
    expect(res.statusCode).toBe(200);

    const [stored] = await db
      .select()
      .from(schema.teacherDecisions)
      .where(eq(schema.teacherDecisions.recommendationId, rec.id));
    // The second candidate, not the first: picking now means something.
    expect(stored.selectedMaterialId).toBe(adapt.materialId);
  });

  it('refuses a MODIFY that modifies nothing', async () => {
    await release('B1 inference practice', 'B1');
    const rec = await fetchRecommendation();

    const res = await decide(rec.id, {
      decision: 'MODIFY',
      teacherNotes: 'Looks fine to me.',
    });
    // Otherwise MODIFY is ACCEPT wearing a different label.
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('must change something');
  });

  it('records a rewritten action and what it replaced', async () => {
    await release('B1 inference practice', 'B1');
    const rec = await fetchRecommendation();
    const original = rec.recommendedActionText;

    const res = await decide(rec.id, {
      decision: 'MODIFY',
      modifiedActionText: 'Pair reading with a short spoken summary.',
    });
    expect(res.statusCode).toBe(200);

    const [updated] = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.id, rec.id));
    expect(updated.recommendedActionText).toBe('Pair reading with a short spoken summary.');

    const [event] = await db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.action, 'TEACHER_DECISION_RECORDED'),
          eq(schema.auditEvents.entityId, rec.id)
        )
      );
    const metadata = event.metadata as Record<string, unknown>;
    // The trail has to show the edit, not merely that one happened.
    expect(metadata.originalActionText).toBe(original);
    expect(metadata.modifiedActionText).toBe('Pair reading with a short spoken summary.');
  });

  // ── no data is not weakness ──────────────────────────────────────────────

  it('does not call an untested skill a shortfall', async () => {
    await release('B1 inference practice', 'B1');
    const rec = await fetchRecommendation();

    // Liam has no evidence, so every skill is untested.
    expect(rec.rationale.basis).toBe('NO_DATA');
    expect(rec.priority).not.toBe('HIGH');
    expect(JSON.stringify(rec.rationale.texts)).not.toContain('below the');
  });
});
