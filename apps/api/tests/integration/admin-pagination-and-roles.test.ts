import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Admin Pagination, Filtering & Role Enforcement', () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'System Admin',
      role: UserRole.ADMIN,
    });

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    studentToken = generateToken({
      id: SEED_IDS.studentEmma,
      email: 'emma.nguyen@student.acorn.edu',
      name: 'Emma Nguyen',
      role: UserRole.STUDENT,
    });
  });

  describe('User listing & filtering', () => {
    it('returns paginated users with total count and metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/identity/users?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page', 1);
      expect(body).toHaveProperty('limit', 5);
      expect(body).toHaveProperty('totalPages');
      expect(body.items.length).toBe(5);
      expect(body.total).toBeGreaterThanOrEqual(12);
      expect(body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('filters users by role with pagination', async () => {
      const studentRes = await app.inject({
        method: 'GET',
        url: '/api/identity/users?role=STUDENT&page=1&limit=20',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(studentRes.statusCode).toBe(200);
      const studentBody = JSON.parse(studentRes.body);
      expect(studentBody.total).toBeGreaterThanOrEqual(10);
      expect(studentBody.items.every((u: any) => u.role === UserRole.STUDENT)).toBe(true);

      const teacherRes = await app.inject({
        method: 'GET',
        url: '/api/identity/users?role=TEACHER&page=1&limit=20',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(teacherRes.statusCode).toBe(200);
      const teacherBody = JSON.parse(teacherRes.body);
      expect(teacherBody.total).toBeGreaterThanOrEqual(1);
      expect(teacherBody.items.every((u: any) => u.role === UserRole.TEACHER)).toBe(true);
      expect(teacherBody.items.some((u: any) => u.email === 'taylor@acorn.edu')).toBe(true);
    });

    it('filters users by search query (name or email)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/identity/users?search=emma',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('Emma Nguyen');
    });

    it('rejects invalid pagination parameters with 400', async () => {
      const resLimit = await app.inject({
        method: 'GET',
        url: '/api/identity/users?limit=500',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resLimit.statusCode).toBe(400);

      const resPage = await app.inject({
        method: 'GET',
        url: '/api/identity/users?page=0',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resPage.statusCode).toBe(400);
    });

    it('rejects student users from listing users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/identity/users',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Database constraint on user roles', () => {
    it('database rejects insert with invalid role via users_role_check constraint', async () => {
      let threw = false;
      try {
        await db.insert(schema.users).values({
          email: 'invalid_role_test@acorn.edu',
          name: 'Invalid Role Test',
          passwordHash: 'hash',
          role: 'ACADEMIC_MANAGER',
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/users_role_check|check constraint/i);
      }
      expect(threw).toBe(true);
    });
  });

  describe('Course listing & filtering', () => {
    it('returns paginated courses with filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/courses?page=1&limit=10&search=ielts',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items[0].code).toBe('IELTS_5_0');
    });

    it('teachers and students cannot create courses', async () => {
      const teacherRes = await app.inject({
        method: 'POST',
        url: '/api/courses',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          code: 'ILLEGAL_COURSE',
          name: 'Illegal Course',
          level: 'B1',
        },
      });
      expect(teacherRes.statusCode).toBe(403);
    });
  });

  describe('Class listing & role scoping', () => {
    it('admin sees paginated classes with total', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/classes?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('teacher sees only their own classes as unpaginated array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/classes',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.every((c: any) => c.teacherId === SEED_IDS.teacherTaylor)).toBe(true);
    });

    it('student sees only enrolled classes as unpaginated array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/classes',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((c: any) => c.id === SEED_IDS.classIeltsA)).toBe(true);
    });
  });

  describe('Class enrollments listing & authorization', () => {
    it('admin can list enrollments of a class with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/classes/${SEED_IDS.classIeltsA}/enrollments?page=1&limit=5`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body.total).toBeGreaterThanOrEqual(10);
      expect(body.items.length).toBe(5);
      expect(body.totalPages).toBeGreaterThanOrEqual(2);
      expect(body.items[0]).toHaveProperty('learnerName');
      expect(body.items[0]).toHaveProperty('learnerEmail');
    });

    it('teacher of the class can list enrollments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/classes/${SEED_IDS.classIeltsA}/enrollments?paginate=true`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBeGreaterThanOrEqual(10);
      expect(body.items.length).toBeGreaterThanOrEqual(10);
    });

    it('student cannot list class enrollments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/classes/${SEED_IDS.classIeltsA}/enrollments`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Taxonomy skills listing & filtering', () => {
    it('returns paginated skills with area and level filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/taxonomy/skills?area=READING&page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items.every((s: any) => s.area === 'READING')).toBe(true);
    });
  });

  describe('Audit events listing & filtering', () => {
    it('admin can list paginated audit events with filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/events?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body.total).toBeGreaterThanOrEqual(18); // minimal IELTS seed has 18 audit events
      expect(body.items.length).toBeLessThanOrEqual(10);
    });

    it('student cannot access audit events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/events',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
