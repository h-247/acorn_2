CREATE TABLE IF NOT EXISTS "class_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"released_at" timestamp DEFAULT now() NOT NULL,
	"released_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "difficulty" text DEFAULT 'MEDIUM' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "is_late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "late_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_materials" ADD CONSTRAINT "class_materials_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_materials" ADD CONSTRAINT "class_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_materials" ADD CONSTRAINT "class_materials_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "class_materials_cls_mat_idx" ON "class_materials" USING btree ("class_id","material_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_materials_class_idx" ON "class_materials" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_materials_mat_idx" ON "class_materials" USING btree ("material_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "materials_course_idx" ON "materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "materials_difficulty_idx" ON "materials" USING btree ("difficulty");