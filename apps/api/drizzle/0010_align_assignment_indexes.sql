-- Two people fixed the same assignment duplication at once. Converge on one.
--
-- `0008_assignment_targets` and `0007_marvelous_mulholland_black` /
-- `0008_wakeful_molten_man` each added a unique index for the same rule. Keep
-- the upstream pair and drop ours, so the table carries one constraint per
-- rule rather than two that can disagree.
--
-- Theirs is also the better predicate: scoped to status = 'OPEN', a closed
-- assignment no longer blocks a fresh one for the same learner - which matters
-- now that closing an assessment closes its assignments.
--
-- This has to run before theirs is created, because the two models disagree
-- about one thing and the old rows have to be brought over first.
DROP INDEX IF EXISTS "assignments_assessment_class_idx";
DROP INDEX IF EXISTS "assignments_assessment_learner_idx";
DROP INDEX IF EXISTS "submissions_assignment_learner_idx";

-- An individual assignment used to carry the class it was made from, as
-- context for the teacher's views. Upstream's index is on
-- (assessment_id, class_id), so a second learner in the same class would
-- collide. Drop the context: it was never what decided who received the work.
UPDATE "assignments" SET "class_id" = NULL WHERE "learner_id" IS NOT NULL;
