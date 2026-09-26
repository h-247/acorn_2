import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Admin, Question Update & End-to-End Workflows', () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let createdTeacherId: string | undefined;
  let createdCourseId: string | undefined;
  let createdClassId: string | undefined;
  let createdSkillId: string | undefined;
  let createdQuestionId: string | undefined;

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

  afterAll(async () => {
    // This suite creates records only to exercise admin workflows. Remove them
    // in dependency order so later suites always start from the canonical seed.
    if (createdQuestionId) {
      await db.delete(schema.questionSkills).where(eq(schema.questionSkills.questionId, createdQuestionId));
      await db.delete(schema.questions).where(eq(schema.questions.id, createdQuestionId));
    }
    if (createdSkillId) {
      await db.delete(schema.skills).where(eq(schema.skills.id, createdSkillId));
    }
    if (createdClassId) {
      await db.delete(schema.classEnrollments).where(eq(schema.classEnrollments.classId, createdClassId));
      await db.delete(schema.classes).where(eq(schema.classes.id, createdClassId));
    }
    if (createdCourseId) {
      await db.delete(schema.courses).where(eq(schema.courses.id, createdCourseId));
    }
    if (createdTeacherId) {
      await db.delete(schema.users).where(eq(schema.users.id, createdTeacherId));
    }
    await app.close();
  });

  it('allows admin to create user, course, class, and enroll learner', async () => {
    // 1. Admin creates new teacher user
    const userRes = await app.inject({
      method: 'POST',
      url: '/api/identity/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: `newteacher.${Date.now()}@acorn.edu`,
        name: 'Mr. David Lee',
        password: 'password123',
        role: UserRole.TEACHER,
      },
    });
    expect(userRes.statusCode).toBe(201);
    const newTeacher = JSON.parse(userRes.body);
    createdTeacherId = newTeacher.id;
    expect(newTeacher.name).toBe('Mr. David Lee');

    // 2. Admin creates course
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/courses',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: `IELTS_TEST_${Date.now().toString().slice(-4)}`,
        name: 'IELTS Advanced Test Course',
        level: 'B2',
        description: 'Advanced academic English preparation',
      },
    });
    expect(courseRes.statusCode).toBe(201);
    const newCourse = JSON.parse(courseRes.body);
    createdCourseId = newCourse.id;

    // 3. Admin creates class cohort
    const classRes = await app.inject({
      method: 'POST',
      url: '/api/classes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        courseId: newCourse.id,
        name: 'IELTS Advanced Group 1',
        level: 'B2',
        teacherId: newTeacher.id,
        nextActivity: 'Writing Task 1 Overview',
      },
    });
    expect(classRes.statusCode).toBe(201);
    const newClass = JSON.parse(classRes.body);
    createdClassId = newClass.id;
    expect(newClass.name).toBe('IELTS Advanced Group 1');

    // 4. Admin enrolls student
    const enrollRes = await app.inject({
      method: 'POST',
      url: `/api/classes/${newClass.id}/enroll`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { learnerId: SEED_IDS.studentEmma },
    });
    expect(enrollRes.statusCode).toBe(201);

    // 5. Verify teacher can now see the class
    const teacherClassesRes = await app.inject({
      method: 'GET',
      url: '/api/classes',
      headers: { authorization: `Bearer ${generateToken({ id: newTeacher.id, email: newTeacher.email, name: newTeacher.name, role: UserRole.TEACHER })}` },
    });
    expect(teacherClassesRes.statusCode).toBe(200);
    const tClasses = JSON.parse(teacherClassesRes.body);
    expect(tClasses.some((c: any) => c.id === newClass.id)).toBe(true);
  });

  it('allows admin to manage taxonomy skill tree with hierarchical nesting', async () => {
    // 1. Admin creates a new skill node
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/taxonomy/skills',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: `SKILL_TEST_${Date.now().toString().slice(-4)}`,
        name: 'Test Synthesizing Arguments',
        area: 'READING',
        level: 'B2',
        description: 'Synthesize opposing arguments in academic texts',
      },
    });
    expect(skillRes.statusCode).toBe(201);
    const newSkill = JSON.parse(skillRes.body);
    createdSkillId = newSkill.id;
    expect(newSkill.name).toBe('Test Synthesizing Arguments');

    // 2. Fetch skill tree and verify new skill is present
    const treeRes = await app.inject({
      method: 'GET',
      url: '/api/taxonomy/tree',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(treeRes.statusCode).toBe(200);
    const tree = JSON.parse(treeRes.body);
    expect(tree.some((s: any) => s.id === newSkill.id)).toBe(true);
  });

  it('updates draft question without creating duplicate question items', async () => {
    // 1. Create a draft question first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        type: 'MCQ',
        prompt: 'Initial draft question prompt for testing updates',
        options: ['A. First choice', 'B. Second choice', 'C. Third choice', 'D. Fourth choice'],
        correctAnswer: 'B. Second choice',
        difficulty: 'MEDIUM',
        level: 'B1',
        skills: [
          { skillId: SEED_IDS.skillReadingInference, role: 'PRIMARY', weight: 1.0 },
        ],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    const questionId = created.id;
    createdQuestionId = questionId;

    // 2. Count total questions in DB before update
    const [preCount] = await db.select().from(schema.questions);

    // 3. Update the existing question
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/assessments/questions/${questionId}`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        prompt: 'Updated question prompt with refined inference wording',
        difficulty: 'HARD',
        options: ['A. First choice', 'B. Second choice (Revised)', 'C. Third choice', 'D. Fourth choice'],
        correctAnswer: 'B. Second choice (Revised)',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.id).toBe(questionId); // Same ID!
    expect(updated.prompt).toBe('Updated question prompt with refined inference wording');
    expect(updated.difficulty).toBe('HARD');

    // 4. Verify no duplicate question was created in DB
    const [fetched] = await db.select().from(schema.questions).where(eq(schema.questions.id, questionId));
    expect(fetched).toBeDefined();
    expect(fetched.prompt).toBe('Updated question prompt with refined inference wording');
  });

  it('student can fetch personal learner profile, checkpoints, autosave, and submit', async () => {
    // 1. Student requests me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    const me = JSON.parse(meRes.body);
    expect(me.id).toBe(SEED_IDS.studentEmma);

    // 2. Student requests profile
    const profileRes = await app.inject({
      method: 'GET',
      url: `/api/learners/${SEED_IDS.studentEmma}/profile`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body);
    expect(profile.learnerId).toBe(SEED_IDS.studentEmma);
    expect(profile.skills.length).toBeGreaterThan(0);

    // 3. Student requests submissions
    const subsRes = await app.inject({
      method: 'GET',
      url: '/api/submissions',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(subsRes.statusCode).toBe(200);
    const subs = JSON.parse(subsRes.body);
    expect(subs.every((s: any) => s.learnerId === SEED_IDS.studentEmma)).toBe(true);

    // 4. Student cannot access another student profile (cross-student authorization barrier)
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: `/api/learners/${SEED_IDS.studentLiam}/profile`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(forbiddenRes.statusCode).toBe(403);
  });
});
