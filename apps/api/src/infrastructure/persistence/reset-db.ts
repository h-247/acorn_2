import { pool, db } from './db.js';
import * as schema from './schema.js';
import { seedDatabase } from './seed.js';
import { sql } from 'drizzle-orm';
import { config } from '../../shared/config.js';

const LOCAL_DEVELOPMENT_DATABASE = {
  host: 'localhost',
  port: '5435',
  name: 'acorn',
};

export async function resetDatabase() {
  // 1. Guard against non-local / production execution
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset database: NODE_ENV is set to production.');
  }

  const databaseUrl = config.databaseUrl;
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to reset database: DATABASE_URL is invalid.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    target.hostname !== LOCAL_DEVELOPMENT_DATABASE.host ||
    (target.port || '5432') !== LOCAL_DEVELOPMENT_DATABASE.port ||
    target.pathname !== `/${LOCAL_DEVELOPMENT_DATABASE.name}`
  ) {
    throw new Error(
      `Refusing to reset database: expected the local development database at ` +
      `${LOCAL_DEVELOPMENT_DATABASE.host}:${LOCAL_DEVELOPMENT_DATABASE.port}/${LOCAL_DEVELOPMENT_DATABASE.name}.`
    );
  }

  const { rows: [{ database }] } = await pool.query<{ database: string }>('SELECT current_database() AS database');
  if (database !== LOCAL_DEVELOPMENT_DATABASE.name) {
    throw new Error(`Refusing to reset database: connected to unexpected database '${database}'.`);
  }

  console.log(`[db:reset] Target connection verified as local (${target.hostname}:${target.port}/${database}). Wiping application data...`);

  // 2. Truncate all tables with RESTART IDENTITY CASCADE
  const tables = [
    'audit_events',
    'teacher_decisions',
    'recommendation_candidates',
    'recommendations',
    'learner_skill_states',
    'learning_evidence',
    'submission_responses',
    'submissions',
    'assignments',
    'assessment_items',
    'assessments',
    'question_skills',
    'questions',
    'material_files',
    'material_provenance',
    'material_versions',
    'class_materials',
    'materials',
    'skills',
    'class_enrollments',
    'classes',
    'courses',
    'users',
  ];

  await pool.query(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`);
  console.log('[db:reset] Successfully truncated all application tables.');

  // 3. Ensure role check constraint exists
  await pool.query(`
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
    ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('ADMIN', 'TEACHER', 'STUDENT'));
  `);
  console.log('[db:reset] Enforced CHECK constraint (role IN (\'ADMIN\', \'TEACHER\', \'STUDENT\')) on users.');

  // 4. Reseed the database
  console.log('[db:reset] Reseeding database with minimal IELTS dataset...');
  await seedDatabase();

  // 5. Query and report counts
  const userRoleCounts = await db
    .select({
      role: schema.users.role,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.users)
    .groupBy(schema.users.role);

  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
  const [coursesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.courses);
  const [classesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.classes);
  const [enrollmentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.classEnrollments);
  const [skillsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.skills);
  const [materialsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.materials);
  const [assessmentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.assessments);
  const [assignmentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.assignments);
  const [submissionsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.submissions);
  const [evidenceCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.learningEvidence);
  const [recommendationsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.recommendations);
  const [decisionsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.teacherDecisions);
  const [auditEventsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.auditEvents);

  console.log('====================================================');
  console.log(' DATABASE RESET AND VERIFICATION COMPLETE');
  console.log('====================================================');
  console.log(`Total Users: ${totalUsers.count}`);
  for (const rc of userRoleCounts) {
    console.log(`  - ${rc.role}: ${rc.count}`);
  }
  console.log(`Courses: ${coursesCount.count} (Target: 1 IELTS 5.0)`);
  console.log(`Classes: ${classesCount.count} (Target: 1)`);
  console.log(`Class Enrollments: ${enrollmentsCount.count} (Target: 10 students)`);
  console.log(`Skills Taxonomy: ${skillsCount.count}`);
  console.log(`Materials: ${materialsCount.count}`);
  console.log(`Assessments: ${assessmentsCount.count}`);
  console.log(`Assignments: ${assignmentsCount.count}`);
  console.log(`Submissions: ${submissionsCount.count}`);
  console.log(`Learning Evidence: ${evidenceCount.count}`);
  console.log(`Recommendations: ${recommendationsCount.count}`);
  console.log(`Teacher Decisions: ${decisionsCount.count}`);
  console.log(`Audit Events: ${auditEventsCount.count}`);
  console.log('====================================================');
}

if (process.argv[1]?.endsWith('reset-db.ts') || process.argv[1]?.endsWith('reset-db.js')) {
  resetDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[db:reset] Fatal error:', err);
      await pool.end();
      process.exit(1);
    });
}
