import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Authorization & Error Boundaries', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let studentToken: string;
  let studentLiamToken: string;
  let adminToken: string;
  let managerToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'System Admin',
      role: UserRole.ADMIN,
    });

    managerToken = generateToken({
      id: '00000000-0000-0000-0000-000000000002',
      email: 'manager@acorn.edu',
      name: 'Academic Manager',
      role: 'ACADEMIC_MANAGER' as any,
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

    studentLiamToken = generateToken({
      id: SEED_IDS.studentLiam,
      email: 'liam.chen@student.acorn.edu',
      name: 'Liam Chen',
      role: UserRole.STUDENT,
    });
  });

  // 1. Password validation tests
  it('rejects missing password on login with 400 validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'taylor@acorn.edu',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid login credentials with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'taylor@acorn.edu',
        password: 'wrongpassword',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects nonexistent user login with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'nonexistent@acorn.edu',
        password: 'wrong',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // 2. Cookie auth flow tests
  it('sets HttpOnly SameSite cookie and returns user without token in JSON response on login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'taylor@acorn.edu',
        password: 'password123',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Verify token is NOT exposed in JSON response
    expect((body as any).token).toBeUndefined();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('taylor@acorn.edu');
    expect(body.user.role).toBe('TEACHER');

    // Verify Set-Cookie header contains HttpOnly, SameSite, Path=/
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('acorn_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
  });

  it('authenticates /me using HttpOnly cookie', async () => {
    // First login to get the cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'taylor@acorn.edu',
        password: 'password123',
      },
    });
    const setCookie = loginRes.headers['set-cookie'] as string;
    const cookieValue = setCookie.split(';')[0];

    // Call /me with Cookie header
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: {
        cookie: cookieValue,
      },
    });
    expect(meRes.statusCode).toBe(200);
    const me = JSON.parse(meRes.body);
    expect(me.email).toBe('taylor@acorn.edu');
    expect(me.name).toBe('Ms. Taylor');
  });

  it('clears session cookie on logout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('acorn_token=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('executes full cookie flow: login (200) -> /me (200) -> logout (200) -> /me (401)', async () => {
    // 1. Login returns 200 with HttpOnly session cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'taylor@acorn.edu',
        password: 'password123',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginCookie = loginRes.headers['set-cookie'] as string;
    expect(loginCookie).toBeDefined();
    const cookieHeader = loginCookie.split(';')[0];

    // 2. /me with session cookie returns 200
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { cookie: cookieHeader },
    });
    expect(meRes.statusCode).toBe(200);
    expect(JSON.parse(meRes.body).email).toBe('taylor@acorn.edu');

    // 3. Bodyless logout POST returns 200 and clears HttpOnly cookie
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      headers: { cookie: cookieHeader },
    });
    expect(logoutRes.statusCode).toBe(200);
    const logoutCookie = logoutRes.headers['set-cookie'] as string;
    expect(logoutCookie).toBeDefined();
    expect(logoutCookie).toContain('acorn_token=;');
    expect(logoutCookie).toContain('Max-Age=0');

    // 4. Subsequent /me with cleared cookie returns 401
    const postLogoutMeRes = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { cookie: 'acorn_token=' },
    });
    expect(postLogoutMeRes.statusCode).toBe(401);
  });

  // 3. Direct UUID rejection / impersonation bypass tests
  it('rejects direct user UUID bearer token with 401 Unauthorized (no UUID bypass)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/materials',
      headers: { authorization: `Bearer ${SEED_IDS.teacherTaylor}` },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects direct student UUID bearer token with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learners/${SEED_IDS.studentEmma}/profile`,
      headers: { authorization: `Bearer ${SEED_IDS.studentEmma}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects direct user UUID in cookie with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { cookie: `acorn_token=${SEED_IDS.teacherTaylor}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects random forged UUID token with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { authorization: 'Bearer deadbeef-dead-beef-dead-beefdeadbeef' },
    });
    expect(res.statusCode).toBe(401);
  });

  // 4. Missing token & general authorization checks
  it('returns 401 when authentication token is missing on protected route', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/materials',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent material when authenticated with valid JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/materials/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 validation error for malformed material creation payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        title: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when student tries to create a material', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        title: 'Student Attempted Material',
        type: 'ARTICLE',
        primarySkillId: '33333333-3333-3333-3333-333333333301',
        level: 'B1',
        content: 'This should fail with 403 Forbidden.',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when student tries to view another student profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/learners/00000000-0000-0000-0000-000000000001/profile',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows student to view their own profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learners/${SEED_IDS.studentEmma}/profile`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Emma Nguyen');
  });

  // 5. Question Bank & Answer Key Protection
  it('denies students access to question bank list with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('denies students access to single question by ID with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/assessments/questions/${SEED_IDS.qInferenceCityLife}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows teacher to access question bank', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('redacts correctAnswer and rubric from questions when retrieved by student in assessments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(200);
    const assessments = JSON.parse(res.body);
    expect(assessments.length).toBeGreaterThan(0);
    for (const a of assessments) {
      for (const it of a.items) {
        expect(it.question.correctAnswer).toBeNull();
        expect(it.question.rubric).toBeNull();
      }
    }
  });

  // 6. Roster Privacy Protection
  it('redacts classmates private details (email, proficiency, needsAttention) when student views class detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classes/${SEED_IDS.classIeltsA}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(200);
    const cls = JSON.parse(res.body);
    expect(cls.learners).toBeDefined();

    const emma = cls.learners.find((l: any) => l.id === SEED_IDS.studentEmma);
    const liam = cls.learners.find((l: any) => l.id === SEED_IDS.studentLiam);

    expect(emma).toBeDefined();
    expect(emma.email).toBe('emma.nguyen@student.acorn.edu');

    expect(liam).toBeDefined();
    expect(liam.email).toBeUndefined();
    expect(liam.overallProficiency).toBeNull();
    expect(liam.needsAttention).toBe(false);
    expect(liam.lastActivityAt).toBeNull();
  });

  // 7. Cross-Learner Submission Protection
  it('denies student from accessing another student submission with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/submissions/${SEED_IDS.submissionEmmaReading}`,
      headers: { authorization: `Bearer ${studentLiamToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // 8. Three-role model enforcement (ACADEMIC_MANAGER and unsupported roles rejected)
  it('rejects unsupported role ACADEMIC_MANAGER on login token authentication with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toContain('Unsupported user role');
  });

  it('rejects creating a user with unsupported role ACADEMIC_MANAGER with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'manager.new@acorn.edu',
        password: 'password123',
        name: 'New Manager',
        role: 'ACADEMIC_MANAGER',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // 9. Admin User Management & Account Deactivation
  it('allows Admin to deactivate user and blocks deactivated user from authenticating', async () => {
    // 1. Admin deactivates Liam
    const deactRes = await app.inject({
      method: 'PUT',
      url: `/api/identity/users/${SEED_IDS.studentLiam}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(deactRes.statusCode).toBe(200);

    // 2. Liam attempts login -> 401 Unauthorized
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'liam.chen@student.acorn.edu',
        password: 'password123',
      },
    });
    expect(loginRes.statusCode).toBe(401);
    expect(JSON.parse(loginRes.body).message).toContain('deactivated');

    // 3. Liam attempts with existing token -> 401 Unauthorized
    const tokenRes = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { authorization: `Bearer ${studentLiamToken}` },
    });
    expect(tokenRes.statusCode).toBe(401);

    // 4. Admin reactivates Liam
    const reactRes = await app.inject({
      method: 'PUT',
      url: `/api/identity/users/${SEED_IDS.studentLiam}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: true },
    });
    expect(reactRes.statusCode).toBe(200);

    // 5. Admin resets Liam's password
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/identity/users/${SEED_IDS.studentLiam}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { newPassword: 'newpassword456' },
    });
    expect(resetRes.statusCode).toBe(200);

    // 6. Liam can login with new password
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'liam.chen@student.acorn.edu',
        password: 'newpassword456',
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
  });

  // 10. Taxonomy cycle check
  it('rejects circular parent reference in taxonomy with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/taxonomy/skills/${SEED_IDS.skillReading}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        parentId: SEED_IDS.skillReading,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('parent');
  });

  // 11. Recommendation to Next Activity Workflow
  it('persists assignment and released material when teacher assigns next activity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${SEED_IDS.recEmmaReadingInference}/assign-next-activity`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        learnerId: SEED_IDS.studentEmma,
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        activityTitle: 'Urban Farming Practice',
        instructions: 'Read passage and summarize key arguments',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.materialId).toBe(SEED_IDS.matUrbanFarming);

    // Verify class now has updated nextActivity
    const classRes = await app.inject({
      method: 'GET',
      url: `/api/classes/${SEED_IDS.classIeltsA}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(classRes.statusCode).toBe(200);
    const classData = JSON.parse(classRes.body);
    expect(classData.nextActivity).toContain('Read passage');
  });
});
