-- Migration 0004: Fix attempt timer and evidence supersession
-- G01: Add actual_started_at to submissions (null until learner explicitly opens attempt)
-- G08: Add is_superseded flag to learning_evidence for correct evidence counting

-- 1. Add actual_started_at to submissions
--    This column records when the learner truly began the attempt.
--    started_at retains its original value (assignment creation time) for audit,
--    but ALL timer calculations must use actual_started_at.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "actual_started_at" timestamp;

-- 2. Back-fill: for existing STARTED/IN_PROGRESS submissions where the learner
--    has clearly interacted (has responses), set actual_started_at = started_at.
--    For SUBMITTED/EVALUATED we also preserve started_at as actual.
UPDATE "submissions"
SET "actual_started_at" = "started_at"
WHERE "status" IN ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED');

-- For bare STARTED submissions that have no responses (i.e. created by assignment
-- but never opened), leave actual_started_at NULL so the timer hasn't begun.
UPDATE "submissions" s
SET "actual_started_at" = s."started_at"
WHERE s."status" = 'STARTED'
  AND EXISTS (
    SELECT 1 FROM "submission_responses" sr
    WHERE sr."submission_id" = s."id"
  );

-- 3. Add is_superseded to learning_evidence
--    When a teacher evaluates/corrects a question that was auto-graded,
--    the original QUESTION_RESULT row is marked superseded = true so it is
--    excluded from learner state computation without being deleted (audit trail).
ALTER TABLE "learning_evidence" ADD COLUMN IF NOT EXISTS "is_superseded" boolean NOT NULL DEFAULT false;

-- 4. Verify new columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'actual_started_at'
  ) THEN
    RAISE EXCEPTION 'Column actual_started_at was not added to submissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_evidence' AND column_name = 'is_superseded'
  ) THEN
    RAISE EXCEPTION 'Column is_superseded was not added to learning_evidence';
  END IF;
END $$;
