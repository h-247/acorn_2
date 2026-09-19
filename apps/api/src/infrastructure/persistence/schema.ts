import { pgTable, text, timestamp, integer, boolean, real, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
});

export const classEnrollments = pgTable('class_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').references(() => classes.id).notNull(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
});

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  area: text('area').notNull(),
  parentId: uuid('parent_id'),
  level: text('level'),
  description: text('description'),
});

export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  primarySkillId: uuid('primary_skill_id').references(() => skills.id).notNull(),
  level: text('level').notNull(),
  estimatedMinutes: integer('estimated_minutes').default(10).notNull(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  currentVersionNumber: integer('current_version_number').default(1).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const materialVersions = pgTable('material_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  changelog: text('changelog'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const materialProvenance = pgTable('material_provenance', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
  adaptationType: text('adaptation_type'),
  aiGenerationId: uuid('ai_generation_id'),
  notes: text('notes'),
});

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
});

export const questionSkills = pgTable('question_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  role: text('role').default('PRIMARY').notNull(),
  weight: real('weight').default(1.0).notNull(),
});

export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  instructions: text('instructions'),
  level: text('level').notNull(),
  status: text('status').notNull(),
  timeLimitMinutes: integer('time_limit_minutes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assessmentItems = pgTable('assessment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  sequenceOrder: integer('sequence_order').notNull(),
  points: real('points').default(1.0).notNull(),
});

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  classId: uuid('class_id').references(() => classes.id),
  learnerId: uuid('learner_id').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  dueAt: timestamp('due_at'),
  status: text('status').default('OPEN').notNull(),
});

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => assignments.id).notNull(),
  assessmentId: uuid('assessment_id').references(() => assessments.id).notNull(),
  learnerId: uuid('learner_id').references(() => users.id).notNull(),
  status: text('status').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  evaluatedAt: timestamp('evaluated_at'),
  evaluatorId: uuid('evaluator_id').references(() => users.id),
  evaluatorType: text('evaluator_type').default('AUTO').notNull(),
  overallScore: real('overall_score'),
  maxPossibleScore: real('max_possible_score').default(100).notNull(),
  teacherFeedback: text('teacher_feedback'),
});

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
});

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
  correctionNotes: text('correction_notes'),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
});

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
});

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recommendationCandidates = pgTable('recommendation_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id).notNull(),
  materialId: uuid('material_id').references(() => materials.id).notNull(),
  action: text('action').notNull(),
  matchReason: text('match_reason').notNull(),
});

export const teacherDecisions = pgTable('teacher_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id).notNull(),
  decision: text('decision').notNull(),
  teacherNotes: text('teacher_notes'),
  selectedMaterialId: uuid('selected_material_id').references(() => materials.id),
  decidedAt: timestamp('decided_at').defaultNow().notNull(),
  teacherId: uuid('teacher_id').references(() => users.id).notNull(),
});

export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskType: text('task_type').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptSummary: text('prompt_summary').notNull(),
  sourceMaterialId: uuid('source_material_id').references(() => materials.id),
  candidateContent: text('candidate_content').notNull(),
  targetSkillId: uuid('target_skill_id').references(() => skills.id).notNull(),
  targetLevel: text('target_level').notNull(),
  generatedQuestions: jsonb('generated_questions'),
  vocabularySupport: jsonb('vocabulary_support'),
  status: text('status').default('PENDING').notNull(),
  teacherNotes: text('teacher_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
