-- Let a skill that is already in use be retired, and make parent_id mean what
-- it says.
--
-- The taxonomy is meant to be configurable - it is invariant 6 in
-- 04-architecture-boundaries - but the only way out of the tree was DELETE, and
-- DELETE is blocked the moment a material, a question or a piece of evidence
-- points at the skill. So a skill that had ever been used could not be removed
-- at all. That bites exactly when the tree is corrected after talking to
-- teachers, which is the whole point of it being configurable.

-- ── 1. Retirement ───────────────────────────────────────────────────────────
--
-- ARCHIVED means "stop offering this when tagging new work". Evidence already
-- recorded against the skill stays valid and keeps counting toward learner
-- state, because what learners did does not become untrue when a centre
-- reorganises its vocabulary.

ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" DROP CONSTRAINT IF EXISTS "skills_status_check";--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_status_idx" ON "skills" USING btree ("status");--> statement-breakpoint

-- ── 2. parent_id becomes a real reference ───────────────────────────────────
--
-- The column was declared bare, so nothing stopped it pointing at a row that
-- does not exist. Orphans are cleared first: on a centre's data this touches
-- nothing, but a migration that assumes its own data is clean is one that fails
-- on somebody else's machine.

UPDATE "skills" SET "parent_id" = NULL
WHERE "parent_id" IS NOT NULL
  AND "parent_id" NOT IN (SELECT "id" FROM "skills");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_id_skills_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
