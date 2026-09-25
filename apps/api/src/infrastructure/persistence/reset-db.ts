import { pool, db } from './db.js';
import * as schema from './schema.js';
import { seedDatabase } from './seed.js';
import { sql } from 'drizzle-orm';
import { config } from '../../shared/config.js';

/** Names that are recognised as safe-to-reset targets.
 *  The demo database (acorn) and the dedicated test database (acorn_test) are
 *  both allowed; everything else is rejected.
 */
const SAFE_DATABASE_NAMES = new Set(['acorn', 'acorn_test']);

/** Safe hosts – only localhost is allowed. */
const SAFE_HOST = 'localhost';

/** Safe ports – the demo stack uses 5435, but acorn_test may also run on the
 *  Docker default 5432. Both are accepted. */
const SAFE_PORTS = new Set(['5432', '5433', '5434', '5435']);

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

  const effectivePort = target.port || '5432';
  const dbName = target.pathname.replace(/^\//, '');

  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Refusing to reset database: DATABASE_URL must use the postgres:// protocol.');
  }

  if (target.hostname !== SAFE_HOST) {
    throw new Error(
      `Refusing to reset database: host '${target.hostname}' is not the expected localhost.`
    );
  }

  if (!SAFE_PORTS.has(effectivePort)) {
    throw new Error(
      `Refusing to reset database: port '${effectivePort}' is not a recognised local development port.`
    );
  }

  if (!SAFE_DATABASE_NAMES.has(dbName)) {
    throw new Error(
      `Refusing to reset database: database name '${dbName}' is not in the safe list ` +
      `(${[...SAFE_DATABASE_NAMES].join(', ')}). ` +
      `Set DATABASE_URL to point at 'acorn_test' for automated tests.`
    );
  }

  const { rows: [{ database }] } = await pool.query<{ database: string }>('SELECT current_database() AS database');
  if (!SAFE_DATABASE_NAMES.has(database)) {
    throw new Error(
      `Refusing to reset database: connected to unexpected database '${database}'. ` +
      `Only ${[...SAFE_DATABASE_NAMES].join(', ')} are recognised safe targets.`
    );
  }

  if (process.env.NODE_ENV === 'test' && database !== 'acorn_test') {
    throw new Error(`Refusing to reset demo database '${database}' in test mode! Tests must target 'acorn_test'.`);
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
