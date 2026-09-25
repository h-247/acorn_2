import { and, eq } from 'drizzle-orm';
import * as schema from '../../infrastructure/persistence/schema.js';

/**
 * The only two ways learning evidence is written.
 *
 * Evidence is the historical record the rest of the product rests on: learner
 * state is derived from it and can be thrown away and rebuilt, but the
 * observations themselves are the only copy of what a learner actually did. So
 * nothing outside this file changes a row's score, and neither function here
 * overwrites one.
 *
 * `appendEvidence` records a first observation and ignores a replay.
 * `supersedeEvidence` records a correction by retiring the old row and writing
 * a new one beside it, which is the same move 0004 already makes when a
 * teacher's marking replaces the machine's - only now it also works when both
 * rows are the same evidence type.
 */

type EvidenceInsert = typeof schema.learningEvidence.$inferInsert;
type EvidenceRow = typeof schema.learningEvidence.$inferSelect;

/**
 * Identifies the one live observation a write is about.
 *
 * Keyed on the answer rather than the paper because a submission is marked in
 * two passes - the machine at submit time, a teacher afterwards - and the two
 * overlap on whatever the machine could already grade.
 */
export interface EvidenceKey {
  submissionId: string;
  questionId: string;
  skillId: string;
  evidenceType: string;
}

/** The live row for this observation, or undefined if there is none yet. */
export async function findLiveEvidence(
  tx: any,
  key: EvidenceKey
): Promise<EvidenceRow | undefined> {
  const [row] = await tx
    .select()
    .from(schema.learningEvidence)
    .where(
      and(
        eq(schema.learningEvidence.submissionId, key.submissionId),
        eq(schema.learningEvidence.questionId, key.questionId),
        eq(schema.learningEvidence.skillId, key.skillId),
        eq(schema.learningEvidence.evidenceType, key.evidenceType),
        eq(schema.learningEvidence.isSuperseded, false)
      )
    );
  return row;
}

/**
 * Record an observation, ignoring a replay of one already recorded.
 *
 * For the grading pass that sees an answer for the first time. Running it twice
 * leaves the same single row, which is what makes a retry after a crash free
 * rather than something to reason about.
 */
export async function appendEvidence(tx: any, values: EvidenceInsert): Promise<void> {
  await tx.insert(schema.learningEvidence).values(values).onConflictDoNothing();
}

export interface SupersedeInput {
  key: EvidenceKey;
  values: EvidenceInsert;
  /** Why the score changed, kept on the replacement row. */
  reason?: string | null;
}

/**
 * Record a corrected observation without destroying the one it replaces.
 *
 * Retire first, insert second, and in that order: while the old row still reads
 * `is_superseded = false` it holds the slot in the partial unique index, and
 * the insert would collide with it.
 *
 * `observed_at` is carried over from the row being replaced. A regrade changes
 * what we know about the learner's answer, not when they wrote it - and learner
 * state orders by that column to pick the most recent evidence, so moving it
 * would quietly reshuffle the window.
 *
 * An identical correction is a no-op. A teacher who saves a marking screen
 * twice should not leave two rows behind.
 */
export async function supersedeEvidence(
  tx: any,
  { key, values, reason = null }: SupersedeInput
): Promise<EvidenceRow> {
  const current = await findLiveEvidence(tx, key);

  if (
    current &&
    current.normalizedScore === values.normalizedScore &&
    current.observedValue === values.observedValue &&
    current.weight === values.weight
  ) {
    return current;
  }

  return replaceRow(tx, current, values, reason);
}

/**
 * Correct one known row's score, leaving the rest of the observation as it was.
 *
 * Separate from `supersedeEvidence` because the caller already holds the row,
 * and because a teacher evaluation of a whole paper carries no question id -
 * so there is no key to look one up by.
 */
export async function correctEvidenceRow(
  tx: any,
  current: EvidenceRow,
  normalizedScore: number,
  reason: string
): Promise<EvidenceRow> {
  const { id, isSuperseded, ...carried } = current;
  return replaceRow(tx, current, { ...carried, normalizedScore } as EvidenceInsert, reason);
}

/** Retire `current` if there is one, then write the replacement beside it. */
async function replaceRow(
  tx: any,
  current: EvidenceRow | undefined,
  values: EvidenceInsert,
  reason: string | null
): Promise<EvidenceRow> {
  if (current) {
    await tx
      .update(schema.learningEvidence)
      .set({ isSuperseded: true })
      .where(eq(schema.learningEvidence.id, current.id));
  }

  const [inserted] = await tx
    .insert(schema.learningEvidence)
    .values({
      ...values,
      observedAt: current?.observedAt ?? values.observedAt,
      isSuperseded: false,
      isCorrected: Boolean(current),
      correctionNotes: reason ?? values.correctionNotes ?? null,
    })
    .returning();

  return inserted;
}
