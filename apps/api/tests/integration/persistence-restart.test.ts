import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole, CEFRLevel, MaterialType } from '@acorn/contracts';

describe('PostgreSQL Persistence Across API Boundary Restart', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'System Admin',
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('persists authorized material record across complete API app boundary restart', async () => {
    const uniqueSuffix = randomUUID();
    const uniqueTitle = `Durable Environmental Study ${uniqueSuffix}`;
    const uniqueSummary = `Verified persistence summary ${uniqueSuffix}`;
    const uniqueContent = `Authoritative reading text preserved in PostgreSQL across server restarts ${uniqueSuffix}`;

    // 1. Create a unique authorized material record via the active API boundary
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        title: uniqueTitle,
        type: MaterialType.ARTICLE,
        primarySkillId: SEED_IDS.skillReadingMainIdea,
        level: CEFRLevel.B1,
        estimatedMinutes: 20,
        source: 'Acorn Quality Gate Persistence Suite',
        summary: uniqueSummary,
        content: uniqueContent,
        tags: ['test', 'persistence'],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdMaterial = JSON.parse(createRes.body);
    const materialId = createdMaterial.id;
    expect(materialId).toBeDefined();
    expect(createdMaterial.title).toBe(uniqueTitle);

    // 2. Shut down and close the active API application boundary
    await app.close();

    // 3. Rebuild and restart the API application boundary from scratch
    app = buildApp();

    // 4. Query the record through the new API boundary and confirm it remains intact
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/materials/${materialId}`,
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
    });

    expect(getRes.statusCode).toBe(200);
    const retrievedMaterial = JSON.parse(getRes.body);
    expect(retrievedMaterial.id).toBe(materialId);
    expect(retrievedMaterial.title).toBe(uniqueTitle);
    expect(retrievedMaterial.summary).toBe(uniqueSummary);
    expect(retrievedMaterial.content).toBe(uniqueContent);
    expect(retrievedMaterial.primarySkillId).toBe(SEED_IDS.skillReadingMainIdea);

    // 5. Query PostgreSQL directly to verify authoritative persistence in the database
    const [dbRecord] = await db
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, materialId));

    expect(dbRecord).toBeDefined();
    expect(dbRecord.id).toBe(materialId);
    expect(dbRecord.title).toBe(uniqueTitle);

    // 6. Confirm the restarted boundary can perform mutations on the persisted record
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}`,
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        title: `${uniqueTitle} (Post-Restart Verified)`,
        summary: `${uniqueSummary} - updated`,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updatedMaterial = JSON.parse(updateRes.body);
    expect(updatedMaterial.title).toBe(`${uniqueTitle} (Post-Restart Verified)`);
  });

  it('persists curriculum course record across API app boundary restart and retains relational queryability', async () => {
    const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const uniqueCode = `PERSIST_${uniqueSuffix}`;
    const uniqueName = `Preserved Curriculum Course ${uniqueSuffix}`;
    const uniqueDesc = `Curriculum description ensuring persistence proof across app rebuilds ${uniqueSuffix}`;

    // 1. Create a unique course via the active API boundary
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/courses',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        code: uniqueCode,
        name: uniqueName,
        level: CEFRLevel.B2,
        description: uniqueDesc,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdCourse = JSON.parse(createRes.body);
    const courseId = createdCourse.id;
    expect(courseId).toBeDefined();
    expect(createdCourse.code).toBe(uniqueCode);

    // 2. Shut down and close the API application boundary
    await app.close();

    // 3. Rebuild and restart the API boundary
    app = buildApp();

    // 4. Confirm the persisted record is returned in course listings from the new boundary
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/courses',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const courses = JSON.parse(listRes.body);
    const found = courses.find((c: any) => c.id === courseId);
    expect(found).toBeDefined();
    expect(found.code).toBe(uniqueCode);
    expect(found.name).toBe(uniqueName);
    expect(found.description).toBe(uniqueDesc);

    // 5. Verify direct database row matches exactly
    const [dbCourse] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, courseId));

    expect(dbCourse).toBeDefined();
    expect(dbCourse.code).toBe(uniqueCode);
    expect(dbCourse.name).toBe(uniqueName);
  });
});
