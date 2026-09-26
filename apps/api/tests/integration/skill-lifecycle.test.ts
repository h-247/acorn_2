import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * The taxonomy has to stay configurable (invariant 6), but the only way out of
 * the tree was DELETE - which is refused the moment a material, question or
 * piece of evidence points at the skill. So a skill that had ever been used
 * could not be removed at all, which bites exactly when the tree is corrected
 * after talking to teachers.
 */
describe('Skill lifecycle', () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'Admin',
      role: UserRole.ADMIN,
    });
  });

  // This file retires part of the taxonomy on purpose. Seeding resets status,
  // but putting it back keeps the file independent of test ordering.
  afterAll(async () => {
    await db.update(schema.skills).set({ status: 'ACTIVE' });
  });

  // A function, not a constant: the describe body runs before beforeAll, so a
  // constant would capture the token while it is still undefined.
  const auth = () => ({ authorization: `Bearer ${adminToken}` });

  it('archives a skill together with everything under it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/taxonomy/skills/${SEED_IDS.skillReading}/archive`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.skill.status).toBe('ARCHIVED');
    expect(body.archivedCount).toBeGreaterThan(1);

    const [child] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, SEED_IDS.skillReadingMainIdea));
    expect(child.status).toBe('ARCHIVED');
  });

  it('keeps archived skills out of the pickers unless asked for', async () => {
    const tree = (await app.inject({ method: 'GET', url: '/api/taxonomy/tree' })).json();
    expect(tree.some((s: any) => s.id === SEED_IDS.skillReading)).toBe(false);

    const all = (
      await app.inject({ method: 'GET', url: '/api/taxonomy/tree?includeArchived=true' })
    ).json();
    expect(all.some((s: any) => s.id === SEED_IDS.skillReading)).toBe(true);
  });

  it('refuses to hang a new skill under an archived parent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/taxonomy/skills',
      headers: auth(),
      payload: {
        code: 'READING_SKIMMING_TEST',
        name: 'Skimming',
        area: 'READING',
        parentId: SEED_IDS.skillReading,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('restores a sub-skill with the ancestors it needs, leaving siblings alone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/taxonomy/skills/${SEED_IDS.skillReadingMainIdea}/restore`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().skill.status).toBe('ACTIVE');

    // The parent came back too, otherwise the child hangs off a node nobody sees.
    const [parent] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, SEED_IDS.skillReading));
    expect(parent.status).toBe('ACTIVE');

    // Archiving the branch was one decision; undoing it must not silently undo
    // the separate decisions made about the leaves.
    const [sibling] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, SEED_IDS.skillReadingDetail));
    expect(sibling.status).toBe('ARCHIVED');
  });

  it('still refuses to delete a skill that evidence points at', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/taxonomy/skills/${SEED_IDS.skillReadingMainIdea}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a parent_id that points at no skill, in the database itself', async () => {
    await expect(
      db.insert(schema.skills).values({
        code: 'ORPHAN_TEST',
        name: 'Orphan',
        area: 'READING',
        parentId: '99999999-9999-9999-9999-999999999999',
      })
    ).rejects.toThrow();
  });
});
