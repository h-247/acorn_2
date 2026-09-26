import { pgTable, text, timestamp, integer, boolean, real, jsonb, uuid, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  tokenVersion: integer('token_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
  roleCheck: check('users_role_check', sql`role IN ('ADMIN', 'TEACHER', 'STUDENT')`),
}));

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  level: text('level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id).notNull(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  teacherId: uuid('teacher_id').references(() => users.id).notNull(),
  nextActivity: text('next_activity'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  teacherIdx: index('classes_teacher_idx').on(table.teacherId),
  courseIdx: index('classes_course_idx').on(table.courseId),
}));

export const classEnrollments = pgTable('class_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').references(() => classes.id).notNull(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
}, (table) => ({
  uniqueEnrollment: uniqueIndex('class_enrollments_class_learner_idx').on(table.classId, table.learnerId),
  learnerIdx: index('class_enrollments_learner_idx').on(table.learnerId),
  classIdx: index('class_enrollments_class_idx').on(table.classId),
}));

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  area: text('area').notNull(),
  // Self reference, so the database refuses a parent that does not exist. The
  // return type is annotated because the table is still being defined here.
  parentId: uuid('parent_id').references((): AnyPgColumn => skills.id, { onDelete: 'set null' }),
  level: text('level'),
  description: text('description'),
  // ARCHIVED means "stop offering this when tagging new work". Evidence already
  // recorded against the skill stays valid and keeps counting, which is why a
  // skill in use is retired rather than deleted.
  status: text('status').default('ACTIVE').notNull(),
}, (table) => ({
  areaIdx: index('skills_area_idx').on(table.area),
  parentIdx: index('skills_parent_idx').on(table.parentId),
  statusIdx: index('skills_status_idx').on(table.status),
  statusCheck: check('skills_status_check', sql`status IN ('ACTIVE', 'ARCHIVED')`),
}));

export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  primarySkillId: uuid('primary_skill_id').references(() => skills.id).notNull(),
  level: text('level').notNull(),
  difficulty: text('difficulty').default('MEDIUM').notNull(),
  topic: text('topic'),
  courseId: uuid('course_id').references(() => courses.id),
  tags: jsonb('tags'),
  estimatedMinutes: integer('estimated_minutes').default(10).notNull(),
  source: text('source').notNull(),
  status: text('status').default('DRAFT').notNull(),
  currentVersionNumber: integer('current_version_number').default(1).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('materials_status_idx').on(table.status),
  skillIdx: index('materials_skill_idx').on(table.primarySkillId),
  levelIdx: index('materials_level_idx').on(table.level),
  courseIdx: index('materials_course_idx').on(table.courseId),
  difficultyIdx: index('materials_difficulty_idx').on(table.difficulty),
}));

export const classMaterials = pgTable('class_materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').references(() => classes.id).notNull(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  releasedAt: timestamp('released_at').defaultNow().notNull(),
  releasedBy: uuid('released_by').references(() => users.id).notNull(),
}, (table) => ({
  uniqueClassMaterial: uniqueIndex('class_materials_cls_mat_idx').on(table.classId, table.materialId),
  classIdx: index('class_materials_class_idx').on(table.classId),
  materialIdx: index('class_materials_mat_idx').on(table.materialId),
}));

export const materialVersions = pgTable('material_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  changelog: text('changelog'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueVersion: uniqueIndex('material_versions_mat_ver_idx').on(table.materialId, table.versionNumber),
}));

export const materialProvenance = pgTable('material_provenance', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
  adaptationType: text('adaptation_type'),
  notes: text('notes'),
}, (table) => ({
  materialIdx: index('material_provenance_mat_idx').on(table.materialId),
  sourceIdx: index('material_provenance_source_idx').on(table.sourceMaterialId),
}));

export const materialFiles = pgTable('material_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  fileName: text('file_name').notNull(),
  fileKey: text('file_key').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => ({
  materialIdx: index('material_files_mat_idx').on(table.materialId),
}));

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  prompt: text('prompt').notNull(),
  passage: text('passage'),
  options: jsonb('options'),
  correctAnswer: text('correct_answer'),
  rubric: jsonb('rubric'),
  difficulty: text('difficulty').notNull(),
  level: text('level').notNull(),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('questions_type_idx').on(table.type),
  levelIdx: index('questions_level_idx').on(table.level),
  difficultyIdx: index('questions_diff_idx').on(table.difficulty),
}));

export const questionSkills = pgTable('question_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  role: text('role').default('PRIMARY').notNull(),
  weight: real('weight').default(1.0).notNull(),
}, (table) => ({
  uniqueQuestionSkill: uniqueIndex('question_skills_q_s_idx').on(table.questionId, table.skillId),
}));

export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  instructions: text('instructions'),
  level: text('level').notNull(),
  status: text('status').default('DRAFT').notNull(),
  timeLimitMinutes: integer('time_limit_minutes').default(20),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('assessments_status_idx').on(table.status),
}));

export const assessmentItems = pgTable('assessment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  sequenceOrder: integer('sequence_order').notNull(),
  points: real('points').default(1.0).notNull(),
}, (table) => ({
  uniqueItem: uniqueIndex('assessment_items_ass_q_idx').on(table.assessmentId, table.questionId),
  orderIdx: index('assessment_items_order_idx').on(table.assessmentId, table.sequenceOrder),
}));

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  classId: uuid('class_id').references(() => classes.id),
  learnerId: uuid('learner_id').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  dueAt: timestamp('due_at'),
  status: text('status').default('OPEN').notNull(),
}, (table) => ({
  classIdx: index('assignments_class_idx').on(table.classId),
  learnerIdx: index('assignments_learner_idx').on(table.learnerId),
  assessmentIdx: index('assignments_assessment_idx').on(table.assessmentId),
  // An assignment names a class or one learner, never both audiences at once.
  oneClassAssignment: uniqueIndex('assignments_assessment_class_idx')
    .on(table.assessmentId, table.classId)
    .where(sql`learner_id is null and class_id is not null`),
  oneLearnerAssignment: uniqueIndex('assignments_assessment_learner_idx')
    .on(table.assessmentId, table.learnerId)
    .where(sql`learner_id is not null`),
}));

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => assignments.id).notNull(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  status: text('status').default('STARTED').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  /** Null until the learner explicitly opens and begins the attempt.
   *  All timer calculations use this field, not startedAt.
   *  startedAt is retained for audit only. */
  actualStartedAt: timestamp('actual_started_at'),
  submittedAt: timestamp('submitted_at'),
  evaluatedAt: timestamp('evaluated_at'),
  evaluatorId: uuid('evaluator_id').references(() => users.id),
  evaluatorType: text('evaluator_type').default('AUTO').notNull(),
  overallScore: real('overall_score'),
  maxPossibleScore: real('max_possible_score').default(100).notNull(),
  teacherFeedback: text('teacher_feedback'),
  isLate: boolean('is_late').default(false).notNull(),
  lateMinutes: integer('late_minutes').default(0).notNull(),
}, (table) => ({
  learnerIdx: index('submissions_learner_idx').on(table.learnerId),
  assignmentIdx: index('submissions_assignment_idx').on(table.assignmentId),
  statusIdx: index('submissions_status_idx').on(table.status),
  // One attempt per learner per assignment, so assigning twice is a no-op.
  oneAttemptPerLearner: uniqueIndex('submissions_assignment_learner_idx').on(
    table.assignmentId,
    table.learnerId
  ),
}));


export const submissionResponses = pgTable('submission_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => submissions.id).notNull(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  responsePayload: jsonb('response_payload'),
  isCorrect: boolean('is_correct'),
  rawScore: real('raw_score'),
  normalizedScore: real('normalized_score'),
  teacherFeedback: text('teacher_feedback'),
  rubricScores: jsonb('rubric_scores'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueResponse: uniqueIndex('submission_responses_sub_q_idx').on(table.submissionId, table.questionId),
}));

export const learningEvidence = pgTable('learning_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  questionId: uuid('question_id').references(() => questions.id),
  assessmentId: uuid('assessment_id').references(() => assessments.id),
  submissionId: uuid('submission_id').references(() => submissions.id),
  evidenceType: text('evidence_type').notNull(),
  evaluatorType: text('evaluator_type').notNull(),
  observedValue: text('observed_value'),
  normalizedScore: real('normalized_score').notNull(),
  difficulty: text('difficulty').notNull(),
  weight: real('weight').default(1.0).notNull(),
  observedAt: timestamp('observed_at').defaultNow().notNull(),
  isCorrected: boolean('is_corrected').default(false).notNull(),
  /** When a teacher evaluation supersedes an earlier auto-grade for the same
   *  question/skill, the earlier row is flagged isSuperseded=true and excluded
   *  from effective score computation. Audit queries may still read it. */
  isSuperseded: boolean('is_superseded').default(false).notNull(),
  correctionNotes: text('correction_notes'),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
}, (table) => ({
  // Scoped to live rows. Covering every row made one observation unique for
  // all time, which is what forced a correction to overwrite its predecessor
  // instead of being written beside it.
  currentIdx: uniqueIndex('learning_evidence_current_idx')
    .on(table.submissionId, table.questionId, table.skillId, table.evidenceType)
    .where(sql`is_superseded = false`),
  liveLearnerSkillIdx: index('learning_evidence_live_learner_skill_idx')
    .on(table.learnerId, table.skillId, table.observedAt)
    .where(sql`is_superseded = false`),
  learnerIdx: index('learning_evidence_learner_idx').on(table.learnerId),
  skillIdx: index('learning_evidence_skill_idx').on(table.skillId),
  observedAtIdx: index('learning_evidence_observed_at_idx').on(table.observedAt),
}));


export const learnerSkillStates = pgTable('learner_skill_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  score: real('score'),
  confidence: text('confidence').notNull(),
  evidenceCount: integer('evidence_count').default(0).notNull(),
  firstEvidenceAt: timestamp('first_evidence_at'),
  lastEvidenceAt: timestamp('last_evidence_at'),
  computationVersion: integer('computation_version').default(1).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueState: uniqueIndex('learner_skill_states_learner_skill_idx').on(table.learnerId, table.skillId),
}));

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  targetSkillId: uuid('target_skill_id').references(() => skills.id).notNull(),
  targetLevel: text('target_level').notNull(),
  priority: text('priority').default('MEDIUM').notNull(),
  recommendedActionText: text('recommended_action_text').notNull(),
  rationale: jsonb('rationale').notNull(),
  evidenceBasisCount: integer('evidence_basis_count').default(0).notNull(),
  learnerCurrentScore: real('learner_current_score'),
  learnerConfidence: text('learner_confidence').notNull(),
  decisionStatus: text('decision_status').default('PENDING').notNull(),
  isStale: boolean('is_stale').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  learnerIdx: index('recommendations_learner_idx').on(table.learnerId),
  statusIdx: index('recommendations_status_idx').on(table.decisionStatus),
}));

export const recommendationCandidates = pgTable('recommendation_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id).notNull(),
  /** Null on a NO_MATCH card: there is nothing in the library to point at. */
  materialId: uuid('material_id').references(() => materials.id),
  action: text('action').notNull(),
  matchReason: text('match_reason').notNull(),
}, (table) => ({
  uniqueCandidate: uniqueIndex('rec_candidates_rec_mat_idx').on(table.recommendationId, table.materialId),
}));

export const teacherDecisions = pgTable('teacher_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id).notNull(),
  decision: text('decision').notNull(),
  teacherNotes: text('teacher_notes'),
  selectedMaterialId: uuid('selected_material_id').references(() => materials.id),
  decidedAt: timestamp('decided_at').defaultNow().notNull(),
  teacherId: uuid('teacher_id').references(() => users.id).notNull(),
}, (table) => ({
  recIdx: index('teacher_decisions_rec_idx').on(table.recommendationId),
  teacherIdx: index('teacher_decisions_teacher_idx').on(table.teacherId),
}));

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  actorIdx: index('audit_events_actor_idx').on(table.actorId),
  actionIdx: index('audit_events_action_idx').on(table.action),
  entityIdx: index('audit_events_entity_idx').on(table.entityType, table.entityId),
}));
