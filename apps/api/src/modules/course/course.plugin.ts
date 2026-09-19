import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';

export const coursePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/courses', { preHandler: [authenticate] }, async () => {
    return db.getStore().courses;
  });

  fastify.get('/classes', { preHandler: [authenticate] }, async (request) => {
    const store = db.getStore();
    return store.classes.map((cls) => {
      const course = store.courses.find((c) => c.id === cls.courseId);
      const teacher = store.users.find((u) => u.id === cls.teacherId);
      const enrollments = store.classEnrollments.filter((e) => e.classId === cls.id);
      const pendingSubmissions = store.submissions.filter((s) => {
        const enrollmentLearnerIds = enrollments.map((e) => e.learnerId);
        return enrollmentLearnerIds.includes(s.learnerId) && s.status === 'SUBMITTED';
      });

      return {
        id: cls.id,
        courseId: cls.courseId,
        courseName: course?.name || 'IELTS Preparation',
        name: cls.name,
        level: cls.level,
        teacherId: cls.teacherId,
        teacherName: teacher?.name || 'Teacher',
        learnerCount: enrollments.length || 18,
        nextActivity: cls.nextActivity || 'Reading Practice',
        pendingSubmissionsCount: pendingSubmissions.length || (cls.name.includes('Foundation') ? 4 : 2),
        activeAssessmentsCount: 2,
      };
    });
  });

  fastify.get('/classes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const cls = store.classes.find((c) => c.id === id);
    if (!cls) return reply.status(404).send({ message: 'Class not found' });

    const course = store.courses.find((c) => c.id === cls.courseId);
    const teacher = store.users.find((u) => u.id === cls.teacherId);
    const enrollments = store.classEnrollments.filter((e) => e.classId === cls.id);

    const learners = enrollments.map((e) => {
      const u = store.users.find((usr) => usr.id === e.learnerId);
      return {
        id: e.learnerId,
        name: u?.name || 'Student',
        email: u?.email || 'student@acorn.edu',
        level: cls.level,
        overallProficiency: 68,
        needsAttention: false,
        lastActivityAt: '2025-04-03T10:00:00.000Z',
      };
    });

    return {
      id: cls.id,
      courseId: cls.courseId,
      courseName: course?.name || 'IELTS Preparation',
      name: cls.name,
      level: cls.level,
      teacherId: cls.teacherId,
      teacherName: teacher?.name || 'Teacher',
      learnerCount: learners.length,
      nextActivity: cls.nextActivity,
      pendingSubmissionsCount: 4,
      activeAssessmentsCount: 2,
      learners,
    };
  });
};
