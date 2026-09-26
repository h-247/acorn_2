-- G14: one assignment per recipient, one attempt per learner.
--
-- Assigning to a list of learners used to write a single assignment row
-- carrying only the first learner's id, while creating submissions for all of
-- them. Everyone but the first ended up with a submission hanging off an
-- assignment that was not theirs. These indexes make the intended shape the
-- only shape the table can hold:
--
--   learner_id IS NULL      -> the whole class has it, one row per class
--   learner_id IS NOT NULL  -> one row per learner, class_id kept for context
--
-- Collapse anything that already violates them before the indexes go on.

-- Keep the earliest submission per (assignment, learner); fold any responses
-- from the discarded rows onto it rather than losing a learner's work.
WITH ranked AS (
    SELECT id,
           first_value(id) OVER (
               PARTITION BY assignment_id, learner_id ORDER BY started_at, id
           ) AS keeper
    FROM submissions
)
UPDATE submission_responses sr
SET submission_id = r.keeper
FROM ranked r
WHERE sr.submission_id = r.id
  AND r.id <> r.keeper
  AND NOT EXISTS (
      SELECT 1 FROM submission_responses keep
      WHERE keep.submission_id = r.keeper
        AND keep.question_id = sr.question_id
  );

DELETE FROM submission_responses sr
USING (
    SELECT id,
           first_value(id) OVER (
               PARTITION BY assignment_id, learner_id ORDER BY started_at, id
           ) AS keeper
    FROM submissions
) r
WHERE sr.submission_id = r.id AND r.id <> r.keeper;

DELETE FROM submissions s
USING (
    SELECT id,
           first_value(id) OVER (
               PARTITION BY assignment_id, learner_id ORDER BY started_at, id
           ) AS keeper
    FROM submissions
) r
WHERE s.id = r.id AND r.id <> r.keeper;

CREATE UNIQUE INDEX IF NOT EXISTS "submissions_assignment_learner_idx"
    ON "submissions" ("assignment_id", "learner_id");

-- One class-wide assignment per assessment and class.
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_assessment_class_idx"
    ON "assignments" ("assessment_id", "class_id")
    WHERE "learner_id" IS NULL AND "class_id" IS NOT NULL;

-- One individual assignment per assessment and learner.
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_assessment_learner_idx"
    ON "assignments" ("assessment_id", "learner_id")
    WHERE "learner_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "assignments_assessment_idx"
    ON "assignments" ("assessment_id");
