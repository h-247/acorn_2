import { z } from 'zod';
import {
  UserRole,
  SkillArea,
  CEFRLevel,
  Difficulty,
  MaterialStatus,
  MaterialType,
  AssessmentStatus,
  QuestionType,
  SubmissionStatus,
  EvidenceType,
  EvaluatorType,
  ConfidenceLevel,
  RecommendationAction,
  TeacherDecisionStatus,
  AIGenerationStatus,
} from './enums.js';

export * from './enums.js';

// --- Identity & Auth ---
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  avatarUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole),
  avatarUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const UpdateUserRequestSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().optional(),
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  newPassword: z.string().min(6),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

// --- Taxonomy & Skills ---
export const SkillNodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  area: z.nativeEnum(SkillArea),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  level: z.nativeEnum(CEFRLevel).optional(),
});
export type SkillNode = z.infer<typeof SkillNodeSchema>;

export const SkillTreeSchema = z.array(
  SkillNodeSchema.extend({
    children: z.array(SkillNodeSchema).optional(),
  })
);
export type SkillTree = z.infer<typeof SkillTreeSchema>;

// --- Course & Class ---
export const ClassSummarySchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseName: z.string(),
  name: z.string(),
  level: z.nativeEnum(CEFRLevel),
  teacherId: z.string().uuid(),
  teacherName: z.string(),
  learnerCount: z.number().int().nonnegative(),
  nextActivity: z.string().optional(),
  pendingSubmissionsCount: z.number().int().nonnegative().default(0),
  activeAssessmentsCount: z.number().int().nonnegative().default(0),
});
export type ClassSummary = z.infer<typeof ClassSummarySchema>;

export const ClassDetailSchema = ClassSummarySchema.extend({
  description: z.string().optional(),
  learners: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      level: z.nativeEnum(CEFRLevel),
      overallProficiency: z.number().min(0).max(100).optional(),
      needsAttention: z.boolean().default(false),
      lastActivityAt: z.string().datetime().optional(),
    })
  ),
});
export type ClassDetail = z.infer<typeof ClassDetailSchema>;

// --- Material ---
export const MaterialProvenanceSchema = z.object({
  sourceMaterialId: z.string().uuid().nullable().optional(),
  sourceMaterialTitle: z.string().optional(),
  adaptationType: z.string().optional(),
  createdFromAIGenerationId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});
export type MaterialProvenance = z.infer<typeof MaterialProvenanceSchema>;

export const MaterialVersionSchema = z.object({
  id: z.string().uuid(),
  materialId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: z.string(),
  summary: z.string().optional(),
  changelog: z.string().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});
export type MaterialVersion = z.infer<typeof MaterialVersionSchema>;

export const MaterialDTOSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.nativeEnum(MaterialType),
  primarySkillId: z.string().uuid(),
  primarySkillName: z.string(),
  level: z.nativeEnum(CEFRLevel),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.MEDIUM),
  topic: z.string().optional(),
  courseId: z.string().uuid().nullable().optional(),
  courseName: z.string().optional(),
  estimatedMinutes: z.number().int().positive().default(10),
  source: z.string(),
  status: z.nativeEnum(MaterialStatus),
  currentVersionNumber: z.number().int().positive(),
  content: z.string(),
  summary: z.string().optional(),
  usageCount: z.number().int().nonnegative().default(0),
  provenance: MaterialProvenanceSchema.optional(),
  tags: z.array(z.string()).default([]),
  sharedWithClassesCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MaterialDTO = z.infer<typeof MaterialDTOSchema>;

/**
 * How long the teacher spent preparing this, in minutes.
 *
 * Optional and self-reported: the product measures teacher effort saved, and
 * nothing in a web request can observe that on its own. Absent means not
 * measured, which is why the metric reports its sample count alongside the
 * average rather than quietly averaging over whatever happened to arrive.
 */
export const PrepDurationMinutesSchema = z.number().positive().max(24 * 60).optional();

export const CreateMaterialRequestSchema = z.object({
  prepDurationMinutes: PrepDurationMinutesSchema,
  title: z.string().min(3),
  type: z.nativeEnum(MaterialType),
  primarySkillId: z.string().uuid(),
  level: z.nativeEnum(CEFRLevel),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.MEDIUM).optional(),
  topic: z.string().optional(),
  courseId: z.string().uuid().optional(),
  estimatedMinutes: z.number().int().positive().default(10),
  content: z.string().min(1),
  summary: z.string().optional(),
  source: z.string().default('Teacher Library'),
  tags: z.array(z.string()).default([]),
});
export type CreateMaterialRequest = z.infer<typeof CreateMaterialRequestSchema>;

export const AdaptMaterialRequestSchema = z.object({
  sourceMaterialId: z.string().uuid(),
  title: z.string().min(3),
  targetSkillId: z.string().uuid().optional(),
  targetLevel: z.nativeEnum(CEFRLevel).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  topic: z.string().optional(),
  courseId: z.string().uuid().optional(),
  contentModifications: z.string().min(1),
  adaptationReason: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type AdaptMaterialRequest = z.infer<typeof AdaptMaterialRequestSchema>;

// --- CEFR ladder ---

/** The levels in order, so "one level up" means the same thing everywhere. */
export const CEFR_ORDER: CEFRLevel[] = [
  CEFRLevel.PRE_A1,
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

/**
 * How many rungs apart two levels are, or null if either is unrecognised.
 *
 * 0 is an exact match and can be reused as it stands; 1 is adjacent and needs
 * adapting; anything further is too far to pass off as the same practice.
 */
export function cefrDistance(a?: string | null, b?: string | null): number | null {
  const left = CEFR_ORDER.indexOf(a as CEFRLevel);
  const right = CEFR_ORDER.indexOf(b as CEFRLevel);
  if (left < 0 || right < 0) return null;
  return Math.abs(left - right);
}

// --- Question & Assessment ---
export const RubricCriterionSchema = z.object({
  criteria: z.string().min(1, 'Criterion cannot be empty'),
  description: z.string().optional(),
  maxScore: z.number().positive('Score must be positive').finite('Score must be finite'),
});

export const QuestionSkillMappingSchema = z.object({
  skillId: z.string().uuid(),
  skillName: z.string().optional(),
  role: z.enum(['PRIMARY', 'SECONDARY']).default('PRIMARY'),
  weight: z.number().min(0).max(1).default(1.0),
});
export type QuestionSkillMapping = z.infer<typeof QuestionSkillMappingSchema>;

export const QuestionDTOSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(QuestionType),
  prompt: z.string(),
  passage: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  rubric: z.array(RubricCriterionSchema).optional(),
  difficulty: z.nativeEnum(Difficulty),
  level: z.nativeEnum(CEFRLevel),
  skills: z.array(QuestionSkillMappingSchema),
  sourceMaterialId: z.string().uuid().nullable().optional(),
  sourceMaterialTitle: z.string().optional(),
  usageCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});
export type QuestionDTO = z.infer<typeof QuestionDTOSchema>;

export const CreateQuestionRequestSchemaBase = z.object({
  type: z.nativeEnum(QuestionType),
  prompt: z.string().min(1),
  passage: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  rubric: z.array(RubricCriterionSchema).optional(),
  difficulty: z.nativeEnum(Difficulty),
  level: z.nativeEnum(CEFRLevel),
  skills: z.array(QuestionSkillMappingSchema).min(1),
  sourceMaterialId: z.string().uuid().optional(),
});

/** What a question of each type must carry before anyone can answer it. */
export interface QuestionShape {
  type: QuestionType;
  options?: string[] | null;
  correctAnswer?: string | null;
  rubric?: unknown[] | null;
}

/**
 * Faults that make a question unanswerable or unmarkable.
 *
 * Returned as `{ path, message }` so the same rule can drive a Zod issue on
 * create, a merged re-check on update, and the readiness check a paper runs
 * before it may be published.
 */
export function findQuestionShapeFaults(q: QuestionShape): Array<{ path: string; message: string }> {
  const faults: Array<{ path: string; message: string }> = [];
  const key = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
  const options = Array.isArray(q.options)
    ? q.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
    : [];

  // A listening question is a multiple choice with audio behind it; the audio
  // itself is checked where the database is reachable.
  if (q.type === QuestionType.MCQ || q.type === QuestionType.LISTENING) {
    if (options.length < 2) {
      faults.push({ path: 'options', message: 'A multiple-choice question needs at least two options.' });
    }
    if (!key) {
      faults.push({ path: 'correctAnswer', message: 'A multiple-choice question needs an answer key.' });
    } else if (options.length > 0 && !options.includes(key)) {
      faults.push({ path: 'correctAnswer', message: 'The answer key must be one of the options.' });
    }
  }

  if (q.type === QuestionType.SHORT_ANSWER && !key) {
    faults.push({ path: 'correctAnswer', message: 'A short-answer question needs an answer key to mark against.' });
  }

  if (q.type === QuestionType.WRITING || q.type === QuestionType.SPEAKING) {
    if (!Array.isArray(q.rubric) || q.rubric.length === 0) {
      faults.push({
        path: 'rubric',
        message: 'Rubric is required and cannot be empty for WRITING and SPEAKING questions.',
      });
    }
  }

  return faults;
}

export const CreateQuestionRequestSchema = CreateQuestionRequestSchemaBase.superRefine((data, ctx) => {
  for (const fault of findQuestionShapeFaults(data)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: fault.message, path: [fault.path] });
  }
});
export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequestSchema>;

export const AssessmentItemDTOSchema = z.object({
  id: z.string().uuid(),
  assessmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  sequenceOrder: z.number().int().positive(),
  points: z.number().positive().default(1),
  question: QuestionDTOSchema,
});
export type AssessmentItemDTO = z.infer<typeof AssessmentItemDTOSchema>;

export const AssessmentDTOSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  level: z.nativeEnum(CEFRLevel),
  status: z.nativeEnum(AssessmentStatus),
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  items: z.array(AssessmentItemDTOSchema).default([]),
  totalPoints: z.number().nonnegative().default(0),
  skillsCovered: z.array(z.string()).default([]),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssessmentDTO = z.infer<typeof AssessmentDTOSchema>;

export const CreateAssessmentRequestSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  instructions: z.string().optional(),
  level: z.nativeEnum(CEFRLevel),
  timeLimitMinutes: z.number().int().positive().optional(),
  questionIds: z.array(z.string().uuid()).min(1),
  /**
   * What each question is worth, keyed by question id.
   *
   * Additive and optional, so callers that only send `questionIds` keep the
   * behaviour they had. Ignored for questions carrying a rubric: there the
   * total comes from the criteria, and letting the two disagree is what the
   * marking screen's maxScore check exists to catch.
   */
  itemPoints: z.record(z.string().uuid(), z.number().positive().max(1000)).optional(),
});
export type CreateAssessmentRequest = z.infer<typeof CreateAssessmentRequestSchema>;

export const AssignAssessmentRequestSchema = z.object({
  assessmentId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  learnerIds: z.array(z.string().uuid()).optional(),
  dueAt: z.string().datetime().optional(),
});
export type AssignAssessmentRequest = z.infer<typeof AssignAssessmentRequestSchema>;

export const AssignNextActivityRequestSchema = z.object({
  learnerId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  assessmentId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  activityTitle: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
});
export type AssignNextActivityRequest = z.infer<typeof AssignNextActivityRequestSchema>;

export const AssignmentDTOSchema = z.object({
  id: z.string().uuid(),
  assessmentId: z.string().uuid(),
  assessmentTitle: z.string(),
  classId: z.string().uuid().nullable().optional(),
  className: z.string().optional(),
  learnerId: z.string().uuid().nullable().optional(),
  learnerName: z.string().optional(),
  assignedAt: z.string().datetime(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(['OPEN', 'SUBMITTED', 'GRADED', 'CLOSED']),
});
export type AssignmentDTO = z.infer<typeof AssignmentDTOSchema>;

// --- Submission & Evaluation ---
export const SubmissionResponseDTOSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  questionId: z.string().uuid(),
  responsePayload: z.any(),
  isCorrect: z.boolean().nullable().optional(),
  rawScore: z.number().nullable().optional(),
  normalizedScore: z.number().min(0).max(1).nullable().optional(),
  teacherFeedback: z.string().optional(),
  rubricScores: z.record(z.number()).optional(),
  updatedAt: z.string().datetime(),
});
export type SubmissionResponseDTO = z.infer<typeof SubmissionResponseDTOSchema>;

export const SubmissionDTOSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  assessmentTitle: z.string(),
  learnerId: z.string().uuid(),
  learnerName: z.string(),
  learnerLevel: z.nativeEnum(CEFRLevel).optional(),
  classId: z.string().uuid().optional(),
  className: z.string().optional(),
  status: z.nativeEnum(SubmissionStatus),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable().optional(),
  evaluatedAt: z.string().datetime().nullable().optional(),
  evaluatorId: z.string().uuid().nullable().optional(),
  evaluatorType: z.nativeEnum(EvaluatorType).default(EvaluatorType.AUTO),
  overallScore: z.number().nullable().optional(),
  maxPossibleScore: z.number().default(100),
  teacherFeedback: z.string().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  assessmentInstructions: z.string().nullable().optional(),
  isLate: z.boolean().default(false),
  lateMinutes: z.number().int().nonnegative().default(0),
  responses: z.array(SubmissionResponseDTOSchema).default([]),
});
export type SubmissionDTO = z.infer<typeof SubmissionDTOSchema>;

export const SaveResponseRequestSchema = z.object({
  questionId: z.string().uuid(),
  responsePayload: z.any(),
});
export type SaveResponseRequest = z.infer<typeof SaveResponseRequestSchema>;

export const SubmitAssessmentRequestSchema = z.object({
  submissionId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      responsePayload: z.any(),
    })
  ),
});
export type SubmitAssessmentRequest = z.infer<typeof SubmitAssessmentRequestSchema>;

export const EvaluateSubmissionRequestSchema = z.object({
  submissionId: z.string().uuid(),
  responses: z.array(
    z.object({
      questionId: z.string().uuid(),
      isCorrect: z.boolean().optional(),
      rawScore: z.number().min(0),
      maxScore: z.number().positive(),
      rubricScores: z.record(z.number()).optional(),
      teacherFeedback: z.string().optional(),
    })
  ),
  overallTeacherFeedback: z.string().optional(),
});
export type EvaluateSubmissionRequest = z.infer<typeof EvaluateSubmissionRequestSchema>;

// --- Learning Evidence ---
export const LearningEvidenceDTOSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  learnerName: z.string().optional(),
  skillId: z.string().uuid(),
  skillName: z.string(),
  skillArea: z.nativeEnum(SkillArea),
  questionId: z.string().uuid().nullable().optional(),
  questionPrompt: z.string().optional(),
  assessmentId: z.string().uuid().nullable().optional(),
  assessmentTitle: z.string().optional(),
  submissionId: z.string().uuid().nullable().optional(),
  evidenceType: z.nativeEnum(EvidenceType),
  evaluatorType: z.nativeEnum(EvaluatorType),
  observedValue: z.string().optional(),
  normalizedScore: z.number().min(0).max(1),
  difficulty: z.nativeEnum(Difficulty),
  weight: z.number().positive().default(1.0),
  observedAt: z.string().datetime(),
  isCorrected: z.boolean().default(false),
  correctionNotes: z.string().optional(),
  sourceMaterialId: z.string().uuid().nullable().optional(),
  sourceMaterialTitle: z.string().optional(),
});
export type LearningEvidenceDTO = z.infer<typeof LearningEvidenceDTOSchema>;

export const EvidenceFilterParamsSchema = z.object({
  learnerId: z.string().uuid(),
  skillId: z.string().uuid().optional(),
  assessmentId: z.string().uuid().optional(),
  limit: z.number().int().positive().default(20),
});
export type EvidenceFilterParams = z.infer<typeof EvidenceFilterParamsSchema>;

export const EvidenceCorrectionRequestSchema = z.object({
  evidenceId: z.string().uuid(),
  correctedNormalizedScore: z.number().min(0).max(1),
  reason: z.string().min(3),
});
export type EvidenceCorrectionRequest = z.infer<typeof EvidenceCorrectionRequestSchema>;

// --- Learner State ---
export type LearnerSkillDetailDTO = {
  skillId: string;
  skillName: string;
  skillCode: string;
  skillArea: SkillArea;
  parentSkillId?: string | null;
  score: number | null;
  scorePercentage: number | null;
  confidence: ConfidenceLevel;
  evidenceCount: number;
  lastEvidenceAt?: string | null;
  subskills?: LearnerSkillDetailDTO[];
};

export const LearnerSkillDetailDTOSchema: z.ZodType<LearnerSkillDetailDTO> = z.lazy(() =>
  z.object({
    skillId: z.string().uuid(),
    skillName: z.string(),
    skillCode: z.string(),
    skillArea: z.nativeEnum(SkillArea),
    parentSkillId: z.string().uuid().nullable().optional(),
    score: z.number().min(0).max(1).nullable(),
    scorePercentage: z.number().min(0).max(100).nullable(),
    confidence: z.nativeEnum(ConfidenceLevel),
    evidenceCount: z.number().int().nonnegative(),
    lastEvidenceAt: z.string().datetime().nullable().optional(),
    subskills: z.array(LearnerSkillDetailDTOSchema).optional(),
  })
);

export const ProgressionPointSchema = z.object({
  timestamp: z.string().datetime(),
  label: z.string(),
  scorePercentage: z.number().min(0).max(100),
  skillId: z.string().uuid().optional(),
  skillName: z.string().optional(),
});
export type ProgressionPoint = z.infer<typeof ProgressionPointSchema>;

export const LearnerStateSummaryDTOSchema = z.object({
  learnerId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  level: z.nativeEnum(CEFRLevel),
  overallProficiency: z.number().min(0).max(100).nullable(),
  overallConfidence: z.nativeEnum(ConfidenceLevel),
  totalEvidenceCount: z.number().int().nonnegative(),
  skillsCoverageRatio: z.number().min(0).max(1),
  skills: z.array(LearnerSkillDetailDTOSchema),
  progression: z.array(ProgressionPointSchema),
  currentFocus: z.string().optional(),
});
export type LearnerStateSummaryDTO = z.infer<typeof LearnerStateSummaryDTOSchema>;

// --- Recommendation & Teacher Decision ---
/**
 * A candidate, or the considered absence of one.
 *
 * A NO_MATCH card carries nulls throughout: the library has nothing for this
 * skill at this level, and borrowing another material's title to fill the gap
 * is what made the empty case read as a suggestion.
 */
export const CandidateMaterialDTOSchema = z.object({
  materialId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  type: z.nativeEnum(MaterialType).nullable(),
  level: z.nativeEnum(CEFRLevel).nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  action: z.nativeEnum(RecommendationAction),
  matchReason: z.string(),
  tags: z.array(z.string()).default([]),
  previouslyUsedCount: z.number().int().nonnegative().default(0),
});
export type CandidateMaterialDTO = z.infer<typeof CandidateMaterialDTOSchema>;

/**
 * Why this recommendation exists, in a form a reader can check.
 *
 * `texts` is what the teacher reads; `basis` is the rule that produced it, kept
 * alongside so the two cannot drift apart; `grounding` names the evidence the
 * figures came from.
 */
export const RecommendationRationaleSchema = z.object({
  texts: z.array(z.string()).default([]),
  basis: z.enum(['BELOW_TARGET', 'NO_DATA', 'CONSOLIDATION']).optional(),
  masteryTarget: z.number().optional(),
  grounding: z.record(z.string(), z.unknown()).optional(),
});
export type RecommendationRationale = z.infer<typeof RecommendationRationaleSchema>;

export const RecommendationDTOSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  learnerName: z.string(),
  targetSkillId: z.string().uuid(),
  targetSkillName: z.string(),
  targetLevel: z.nativeEnum(CEFRLevel),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  recommendedActionText: z.string(),
  rationale: RecommendationRationaleSchema,
  evidenceBasisCount: z.number().int().nonnegative(),
  learnerCurrentScore: z.number().nullable(),
  learnerConfidence: z.nativeEnum(ConfidenceLevel),
  candidates: z.array(CandidateMaterialDTOSchema),
  decisionStatus: z.nativeEnum(TeacherDecisionStatus).default(TeacherDecisionStatus.PENDING),
  isStale: z.boolean().default(false).optional(),
  teacherDecision: z
    .object({
      id: z.string().uuid(),
      decision: z.nativeEnum(TeacherDecisionStatus),
      teacherNotes: z.string().optional(),
      selectedMaterialId: z.string().uuid().nullable().optional(),
      decidedAt: z.string().datetime(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
});
export type RecommendationDTO = z.infer<typeof RecommendationDTOSchema>;

export const TeacherDecisionRequestSchema = z.object({
  recommendationId: z.string().uuid(),
  decision: z.enum(['ACCEPT', 'MODIFY', 'REJECT']),
  teacherNotes: z.string().max(500).optional(),
  // Null is a real answer: a NO_MATCH candidate has no material to select.
  selectedMaterialId: z.string().uuid().nullish(),
  modifiedActionText: z.string().nullish(),
});
export type TeacherDecisionRequest = z.infer<typeof TeacherDecisionRequestSchema>;

// --- AI Assistance & Review ---

export const AICandidateDTOSchema = z.object({
  id: z.string().uuid(),
  taskType: z.string(),
  provider: z.string(),
  model: z.string(),
  promptSummary: z.string(),
  sourceMaterialId: z.string().uuid().nullable().optional(),
  sourceMaterialTitle: z.string().optional(),
  sourceContent: z.string().optional(),
  candidateContent: z.string(),
  targetSkillId: z.string().uuid(),
  targetSkillName: z.string(),
  targetLevel: z.nativeEnum(CEFRLevel),
  generatedQuestions: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.string(),
        skillName: z.string(),
      })
    )
    .optional(),
  vocabularySupport: z
    .array(
      z.object({
        term: z.string(),
        definition: z.string(),
      })
    )
    .optional(),
  validation: z.object({
    isSchemaValid: z.boolean(),
    skillMappingPresent: z.boolean(),
    answerKeyProvided: z.boolean(),
    requiresTeacherApproval: z.boolean().default(true),
  }),
  status: z.nativeEnum(AIGenerationStatus),
  teacherNotes: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type AICandidateDTO = z.infer<typeof AICandidateDTOSchema>;

export const AIReviewDecisionRequestSchema = z.object({
  generationId: z.string().uuid(),
  decision: z.enum(['APPROVE', 'REVISE', 'REJECT']),
  editedContent: z.string().optional(),
  teacherNotes: z.string().optional(),
});
export type AIReviewDecisionRequest = z.infer<typeof AIReviewDecisionRequestSchema>;

// --- Audit & Pilot Metrics ---
export const AuditEventDTOSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable().optional(),
  actorName: z.string().optional(),
  actorRole: z.string().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});
export type AuditEventDTO = z.infer<typeof AuditEventDTOSchema>;

export const PilotMetricsDTOSchema = z.object({
  totalMaterials: z.number().int().nonnegative(),
  materialsDirectReuseCount: z.number().int().nonnegative(),
  materialsAdaptedCount: z.number().int().nonnegative(),
  materialsNewCreatedCount: z.number().int().nonnegative(),
  reuseRate: z.number().min(0).max(1),
  totalSubmissions: z.number().int().nonnegative(),
  totalEvidenceRecorded: z.number().int().nonnegative(),
  recommendationsTotal: z.number().int().nonnegative(),
  recommendationsAcceptedCount: z.number().int().nonnegative(),
  recommendationsAcceptedRate: z.number().min(0).max(1),
  averageTeacherPrepMinutes: z.number().nonnegative(),
});
export type PilotMetricsDTO = z.infer<typeof PilotMetricsDTOSchema>;
