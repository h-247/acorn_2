-- G15: a NO_MATCH candidate points at nothing.
--
-- When the library holds nothing for the target skill, the engine used to
-- attach whatever material happened to sort first and label it NO_MATCH. The
-- card then showed a real title and a real link, so the one case that means
-- "there is nothing here, write something" looked like a suggestion.
--
-- A candidate with no material is that case, said honestly.
ALTER TABLE "recommendation_candidates" ALTER COLUMN "material_id" DROP NOT NULL;

-- Only one such card per recommendation; the existing unique index covers
-- material-backed rows but treats every NULL as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS "rec_candidates_no_match_idx"
    ON "recommendation_candidates" ("recommendation_id")
    WHERE "material_id" IS NULL;
