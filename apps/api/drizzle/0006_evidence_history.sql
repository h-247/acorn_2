-- Let a corrected observation keep its predecessor.
--
-- 0004 gave learning_evidence an `is_superseded` flag and used it for the case
-- where a teacher's RUBRIC_RESULT replaces the machine's QUESTION_RESULT. That
-- works because the two rows differ by evidence_type, so the uniqueness rule
-- sees them as different observations.
--
-- A teacher marking the same question a second time has no such luck: same
-- submission, same question, same skill, same type. The index below used to
-- cover every row in the table, so a second RUBRIC_RESULT could not be written
-- at all - which is why the insert had to fall back to ON CONFLICT DO UPDATE
-- and overwrite the first marking in place. The overwrite was forced by this
-- index, not chosen.
--
-- Scoping the index to live rows removes that constraint. One current row per
-- observation, and as many retired ones beside it as the marking history needs.

DROP INDEX IF EXISTS "learning_evidence_idempotency_idx";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "learning_evidence_current_idx"
    ON "learning_evidence" ("submission_id", "question_id", "skill_id", "evidence_type")
    WHERE "is_superseded" = false;--> statement-breakpoint

-- Learner state reads live rows for one learner and skill, newest first.
CREATE INDEX IF NOT EXISTS "learning_evidence_live_learner_skill_idx"
    ON "learning_evidence" ("learner_id", "skill_id", "observed_at")
    WHERE "is_superseded" = false;
