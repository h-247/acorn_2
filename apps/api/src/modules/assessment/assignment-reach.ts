import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import * as schema from '../../infrastructure/persistence/schema.js';

/**
 * Who an assignment reaches.
 *
 * An assignment names either a class or one learner:
 *
 *   learner_id IS NULL     -> the whole class, everyone enrolled in class_id
 *   learner_id IS NOT NULL -> that learner alone
 *
 * An individual assignment may still carry the class it was made from, so the
 * teacher's own views can group it. That context must never widen who receives
 * it, which is why class_id alone is not enough to match.
 */
export function assignmentReachesLearnerSql(learnerId: string, classIds: string[]): SQL {
  const named = eq(schema.assignments.learnerId, learnerId);
  if (classIds.length === 0) return named;

  return or(
    named,
    and(isNull(schema.assignments.learnerId), inArray(schema.assignments.classId, classIds))
  )!;
}

/** The same rule, for rows already in hand. */
export function assignmentReachesLearner(
  assignment: { learnerId: string | null; classId: string | null },
  learnerId: string,
  classIds: string[]
): boolean {
  if (assignment.learnerId) return assignment.learnerId === learnerId;
  return Boolean(assignment.classId && classIds.includes(assignment.classId));
}
