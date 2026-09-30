import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, inArray, or, ilike, sql, asc } from 'drizzle-orm';
import { authenticate, requireRole, assertClassAccess } from '../../infrastructure/auth/auth.js';
import { UserRole, CEFRLevel } from '@acorn/contracts';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors.js';
import { z } from 'zod';

const CreateCourseSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  level: z.nativeEnum(CEFRLevel),
});

const CourseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  level: z.nativeEnum(CEFRLevel).optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

const CreateClassSchema = z.object({
  courseId: z.string().uuid(),
  name: z.string().min(2),
  level: z.nativeEnum(CEFRLevel),
  teacherId: z.string().uuid(),
  nextActivity: z.string().optional(),
});

const ClassQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  level: z.nativeEnum(CEFRLevel).optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

const ClassEnrollmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

export const coursePlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Get Courses (with optional filtering & pagination)
  fastify.get('/courses', { preHandler: [authenticate] }, async (request) => {
    const parsedQuery = CourseQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    const conditions: any[] = [];
    if (parsedQuery.level) {
      conditions.push(eq(schema.courses.level, parsedQuery.level));
    }
    if (parsedQuery.search && parsedQuery.search.trim()) {
      const term = `%${parsedQuery.search.trim()}%`;
      conditions.push(or(ilike(schema.courses.name, term), ilike(schema.courses.code, term)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const isPaginatedRequest =
      rawQuery.page !== undefined ||
      rawQuery.limit !== undefined ||
      rawQuery.search !== undefined ||
      rawQuery.level !== undefined ||
      rawQuery.paginate === 'true';

    if (isPaginatedRequest && !parsedQuery.all) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.courses)
        .where(whereClause);
      const total = countResult?.count ?? 0;

      const items = await db
        .select()
        .from(schema.courses)
        .where(whereClause)
        .orderBy(asc(schema.courses.code), asc(schema.courses.name), asc(schema.courses.id))
        .limit(parsedQuery.limit)
        .offset((parsedQuery.page - 1) * parsedQuery.limit);

      return {
        items,
        total,
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        totalPages: Math.ceil(total / parsedQuery.limit) || 1,
      };
    }

    const rows = await db
      .select()
      .from(schema.courses)
      .where(whereClause)
      .orderBy(asc(schema.courses.code), asc(schema.courses.name), asc(schema.courses.id));

    if (rawQuery.paginate === 'true' || isPaginatedRequest) {
      return {
        items: rows,
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
      };
    }

    return rows;
  });

  // Admin: Create Course
  fastify.post('/courses', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateCourseSchema.parse(request.body);
    const [created] = await db
      .insert(schema.courses)
      .values(body)
      .returning();
    return reply.status(201).send(created);
  });

  // 2. Get Classes (scoped by role, with optional filtering & pagination)
  fastify.get('/classes', { preHandler: [authenticate] }, async (request) => {
    const user = request.user!;
    const parsedQuery = ClassQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    const conditions: any[] = [];
    if (user.role === UserRole.TEACHER) {
      conditions.push(eq(schema.classes.teacherId, user.id));
    } else if (user.role === UserRole.STUDENT) {
      const enrollments = await db
        .select()
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const enrolledClassIds = enrollments.map((e) => e.classId);
      if (enrolledClassIds.length === 0) {
        if (rawQuery.paginate === 'true' || rawQuery.page !== undefined || rawQuery.limit !== undefined) {
          return { items: [], total: 0, page: parsedQuery.page, limit: parsedQuery.limit, totalPages: 0 };
        }
        return [];
      }
      conditions.push(inArray(schema.classes.id, enrolledClassIds));
    }

    if (parsedQuery.courseId) {
      conditions.push(eq(schema.classes.courseId, parsedQuery.courseId));
    }
    if (parsedQuery.teacherId) {
      conditions.push(eq(schema.classes.teacherId, parsedQuery.teacherId));
    }
    if (parsedQuery.level) {
      conditions.push(eq(schema.classes.level, parsedQuery.level));
    }
    if (parsedQuery.search && parsedQuery.search.trim()) {
      const term = `%${parsedQuery.search.trim()}%`;
      conditions.push(ilike(schema.classes.name, term));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const isPaginatedRequest =
      rawQuery.page !== undefined ||
      rawQuery.limit !== undefined ||
      rawQuery.search !== undefined ||
      rawQuery.courseId !== undefined ||
      rawQuery.teacherId !== undefined ||
      rawQuery.level !== undefined ||
      rawQuery.paginate === 'true';

    let total = 0;
    let classRows: any[] = [];

    if (isPaginatedRequest && !parsedQuery.all) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classes)
        .where(whereClause);
      total = countResult?.count ?? 0;

      classRows = await db
        .select()
        .from(schema.classes)
        .where(whereClause)
        .orderBy(asc(schema.classes.name), asc(schema.classes.id))
        .limit(parsedQuery.limit)
        .offset((parsedQuery.page - 1) * parsedQuery.limit);
    } else {
      classRows = await db
        .select()
        .from(schema.classes)
        .where(whereClause)
        .orderBy(asc(schema.classes.name), asc(schema.classes.id));
      total = classRows.length;
    }

    const courses = await db.select().from(schema.courses);
    const teachers = await db.select().from(schema.users);
    const allEnrollments = await db.select().from(schema.classEnrollments);
    const allAssignments = await db.select().from(schema.assignments);
    const allSubmissions = await db.select().from(schema.submissions);

    const items = classRows.map((cls) => {
      const course = courses.find((c) => c.id === cls.courseId);
      const teacher = teachers.find((t) => t.id === cls.teacherId);
      const enrollments = allEnrollments.filter((e) => e.classId === cls.id);
      const learnerIds = new Set(enrollments.map((e) => e.learnerId));

      const activeAssignments = allAssignments.filter(
        (a) => a.classId === cls.id && a.status === 'OPEN'
      );

      const pendingSubs = allSubmissions.filter(
        (s) => learnerIds.has(s.learnerId) && s.status === 'SUBMITTED'
      );

      return {
        id: cls.id,
        courseId: cls.courseId,
        courseName: course?.name || 'English Course',
        name: cls.name,
        level: cls.level,
        teacherId: cls.teacherId,
        teacherName: teacher?.name || 'Teacher',
        learnerCount: enrollments.length,
        nextActivity: cls.nextActivity || '',
        pendingSubmissionsCount: pendingSubs.length,
        activeAssessmentsCount: activeAssignments.length,
      };
    });

    if (isPaginatedRequest && !parsedQuery.all) {
      return {
        items,
        total,
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        totalPages: Math.ceil(total / parsedQuery.limit) || 1,
      };
    }

    if (rawQuery.paginate === 'true') {
      return {
        items,
        total,
        page: 1,
        limit: items.length,
        totalPages: 1,
      };
    }

    return items;
  });

  // 3. Get Class Detail (strictly checks permissions)
  fastify.get('/classes/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    await assertClassAccess(request.user!, id);

    const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, id));
    if (!cls) throw new NotFoundError('Class not found');

    const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, cls.courseId));
    const [teacher] = await db.select().from(schema.users).where(eq(schema.users.id, cls.teacherId));

    const enrollments = await db
      .select()
      .from(schema.classEnrollments)
      .where(eq(schema.classEnrollments.classId, cls.id));

    const learnerIds = enrollments.map((e) => e.learnerId);
    let learners: any[] = [];

    if (learnerIds.length > 0) {
      const learnerUsers = await db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, learnerIds));

      const evidenceRows = await db
        .select()
        .from(schema.learningEvidence)
        .where(inArray(schema.learningEvidence.learnerId, learnerIds));

      const isStudent = request.user!.role === UserRole.STUDENT;
      learners = learnerUsers.map((u) => {
        const isSelf = u.id === request.user!.id;
        if (isStudent && !isSelf) {
          return {
            id: u.id,
            name: u.name,
            email: undefined,
            level: cls.level,
            overallProficiency: null,
            needsAttention: false,
            lastActivityAt: null,
          };
        }

        const studentEvidence = evidenceRows.filter((ev) => ev.learnerId === u.id);
        let overallProficiency: number | null = null;
        if (studentEvidence.length > 0) {
          const totalScore = studentEvidence.reduce((sum, ev) => sum + ev.normalizedScore * ev.weight, 0);
          const totalWeight = studentEvidence.reduce((sum, ev) => sum + ev.weight, 0);
          overallProficiency = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : null;
        }

        const lastEv = studentEvidence.sort(
          (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
        )[0];

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          level: cls.level,
          overallProficiency,
          needsAttention: overallProficiency !== null && overallProficiency < 60,
          lastActivityAt: lastEv ? lastEv.observedAt.toISOString() : null,
        };
      });
    }

    const activeAssignments = await db
      .select()
      .from(schema.assignments)
      .where(and(eq(schema.assignments.classId, cls.id), eq(schema.assignments.status, 'OPEN')));

    const isStudent = request.user!.role === UserRole.STUDENT;
    const pendingSubmissions = await db
      .select()
      .from(schema.submissions)
      .where(
        isStudent
          ? and(
              eq(schema.submissions.learnerId, request.user!.id),
              eq(schema.submissions.status, 'SUBMITTED')
            )
          : learnerIds.length > 0
          ? and(
              inArray(schema.submissions.learnerId, learnerIds),
              eq(schema.submissions.status, 'SUBMITTED')
            )
          : eq(schema.submissions.status, 'SUBMITTED')
      );

    return {
      id: cls.id,
      courseId: cls.courseId,
      courseName: course?.name || 'English Course',
      name: cls.name,
      level: cls.level,
      teacherId: cls.teacherId,
      teacherName: teacher?.name || 'Teacher',
      learnerCount: learners.length,
      nextActivity: cls.nextActivity,
      pendingSubmissionsCount: pendingSubmissions.length,
      activeAssessmentsCount: activeAssignments.length,
      learners,
    };
  });

  // Admin: Create Class
  fastify.post('/classes', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateClassSchema.parse(request.body);

    const [teacher] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, body.teacherId));

    if (!teacher || (teacher.role !== UserRole.TEACHER && teacher.role !== UserRole.ADMIN)) {
      throw new BadRequestError('Assigned teacher must have TEACHER or ADMIN role');
    }

    const [created] = await db
      .insert(schema.classes)
      .values(body)
      .returning();
    return reply.status(201).send(created);
  });

  // Get Class Enrollments (with pagination & search)
  fastify.get('/classes/:id/enrollments', { preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.TEACHER])] }, async (request) => {
    const { id } = request.params as { id: string };
    await assertClassAccess(request.user!, id);

    const parsedQuery = ClassEnrollmentQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    const conditions: any[] = [eq(schema.classEnrollments.classId, id)];

    if (parsedQuery.search && parsedQuery.search.trim()) {
      const term = `%${parsedQuery.search.trim()}%`;
      conditions.push(or(ilike(schema.users.name, term), ilike(schema.users.email, term)));
    }

    const whereClause = and(...conditions);

    const isPaginatedRequest =
      rawQuery.page !== undefined ||
      rawQuery.limit !== undefined ||
      rawQuery.search !== undefined ||
      rawQuery.paginate === 'true';

    if (isPaginatedRequest && !parsedQuery.all) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classEnrollments)
        .innerJoin(schema.users, eq(schema.classEnrollments.learnerId, schema.users.id))
        .where(whereClause);

      const total = countResult?.count ?? 0;

      const items = await db
        .select({
          classId: schema.classEnrollments.classId,
          learnerId: schema.classEnrollments.learnerId,
          enrolledAt: schema.classEnrollments.enrolledAt,
          learnerName: schema.users.name,
          learnerEmail: schema.users.email,
          learnerRole: schema.users.role,
        })
        .from(schema.classEnrollments)
        .innerJoin(schema.users, eq(schema.classEnrollments.learnerId, schema.users.id))
        .where(whereClause)
        .orderBy(asc(schema.users.name), asc(schema.classEnrollments.learnerId))
        .limit(parsedQuery.limit)
        .offset((parsedQuery.page - 1) * parsedQuery.limit);

      return {
        items,
        total,
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        totalPages: Math.ceil(total / parsedQuery.limit) || 1,
      };
    }

    const rows = await db
      .select({
        classId: schema.classEnrollments.classId,
        learnerId: schema.classEnrollments.learnerId,
        enrolledAt: schema.classEnrollments.enrolledAt,
        learnerName: schema.users.name,
        learnerEmail: schema.users.email,
        learnerRole: schema.users.role,
      })
      .from(schema.classEnrollments)
      .innerJoin(schema.users, eq(schema.classEnrollments.learnerId, schema.users.id))
      .where(whereClause)
      .orderBy(asc(schema.users.name), asc(schema.classEnrollments.learnerId));

    if (rawQuery.paginate === 'true' || isPaginatedRequest) {
      return {
        items: rows,
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
      };
    }

    return rows;
  });

  // Enroll Learner
  fastify.post('/classes/:id/enroll', { preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.TEACHER])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { learnerId } = z.object({ learnerId: z.string().uuid() }).parse(request.body);

    const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, id));
    if (!cls) throw new NotFoundError('Class not found');

    if (request.user!.role === UserRole.TEACHER && cls.teacherId !== request.user!.id) {
      throw new ForbiddenError('You can only enroll students into your own classes');
    }

    const [learner] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, learnerId));

    if (!learner || learner.role !== UserRole.STUDENT) {
      throw new BadRequestError('Enrolled user must have STUDENT role');
    }

    const [enrollment] = await db
      .insert(schema.classEnrollments)
      .values({ classId: id, learnerId })
      .onConflictDoNothing()
      .returning();

    return reply.status(201).send(enrollment || { classId: id, learnerId, message: 'Already enrolled' });
  });

  // Admin / Teacher: Unenroll Learner
  fastify.delete('/classes/:id/enroll/:learnerId', { preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.TEACHER])] }, async (request) => {
    const { id, learnerId } = request.params as { id: string; learnerId: string };
    const user = request.user!;
    const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, id));
    if (!cls) throw new NotFoundError('Class not found');
    if (user.role === UserRole.TEACHER && cls.teacherId !== user.id) {
      throw new ForbiddenError('You can only unenroll students from your own classes');
    }
    await db
      .delete(schema.classEnrollments)
      .where(and(eq(schema.classEnrollments.classId, id), eq(schema.classEnrollments.learnerId, learnerId)));
    return { success: true };
  });

  // Update Course
  fastify.put('/courses/:id', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = CreateCourseSchema.partial().parse(request.body);

    const [updated] = await db
      .update(schema.courses)
      .set(body)
      .where(eq(schema.courses.id, id))
      .returning();

    if (!updated) throw new NotFoundError('Course not found');
    return updated;
  });

  // Update Class
  fastify.put('/classes/:id', { preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.TEACHER])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = CreateClassSchema.partial().parse(request.body);

    const [existing] = await db.select().from(schema.classes).where(eq(schema.classes.id, id));
    if (!existing) throw new NotFoundError('Class not found');

    if (request.user!.role === UserRole.TEACHER && existing.teacherId !== request.user!.id) {
      throw new ForbiddenError('You can only update your own classes');
    }

    if (body.teacherId && body.teacherId !== existing.teacherId) {
      if (request.user!.role === UserRole.TEACHER) {
        throw new ForbiddenError('Teachers cannot reassign class teacher');
      }
      const [newTeacher] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, body.teacherId));
      if (!newTeacher || (newTeacher.role !== UserRole.TEACHER && newTeacher.role !== UserRole.ADMIN)) {
        throw new BadRequestError('Assigned teacher must have TEACHER or ADMIN role');
      }
    }

    const [updated] = await db
      .update(schema.classes)
      .set(body)
      .where(eq(schema.classes.id, id))
      .returning();

    return updated;
  });
};
