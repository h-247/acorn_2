export const UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SkillArea = {
  READING: 'READING',
  LISTENING: 'LISTENING',
  SPEAKING: 'SPEAKING',
  WRITING: 'WRITING',
  GRAMMAR: 'GRAMMAR',
  VOCABULARY: 'VOCABULARY',
} as const;
export type SkillArea = (typeof SkillArea)[keyof typeof SkillArea];

export const CEFRLevel = {
  PRE_A1: 'Pre-A1',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
  C2: 'C2',
} as const;
export type CEFRLevel = (typeof CEFRLevel)[keyof typeof CEFRLevel];

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const MaterialStatus = {
  DRAFT: 'DRAFT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type MaterialStatus = (typeof MaterialStatus)[keyof typeof MaterialStatus];

export const MaterialType = {
  ARTICLE: 'ARTICLE',
  AUDIO: 'AUDIO',
  WORKSHEET: 'WORKSHEET',
  ACTIVITY: 'ACTIVITY',
  FLASHCARDS: 'FLASHCARDS',
  RUBRIC: 'RUBRIC',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const AssessmentStatus = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const QuestionType = {
  MCQ: 'MCQ',
  SHORT_ANSWER: 'SHORT_ANSWER',
  WRITING: 'WRITING',
  SPEAKING: 'SPEAKING',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const SubmissionStatus = {
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  EVALUATING: 'EVALUATING',
  EVALUATED: 'EVALUATED',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const EvidenceType = {
  QUESTION_RESULT: 'QUESTION_RESULT',
  RUBRIC_RESULT: 'RUBRIC_RESULT',
  TEACHER_EVALUATION: 'TEACHER_EVALUATION',
} as const;
export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

export const EvaluatorType = {
  AUTO: 'AUTO',
  TEACHER: 'TEACHER',
} as const;
export type EvaluatorType = (typeof EvaluatorType)[keyof typeof EvaluatorType];

export const ConfidenceLevel = {
  NO_DATA: 'NO_DATA',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];

export const RecommendationAction = {
  REUSE: 'REUSE',
  ADAPT: 'ADAPT',
  NO_MATCH: 'NO_MATCH',
} as const;
export type RecommendationAction = (typeof RecommendationAction)[keyof typeof RecommendationAction];

export const TeacherDecisionStatus = {
  PENDING: 'PENDING',
  ACCEPT: 'ACCEPT',
  MODIFY: 'MODIFY',
  REJECT: 'REJECT',
} as const;
export type TeacherDecisionStatus = (typeof TeacherDecisionStatus)[keyof typeof TeacherDecisionStatus];

export const AIGenerationStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const;
export type AIGenerationStatus = (typeof AIGenerationStatus)[keyof typeof AIGenerationStatus];
