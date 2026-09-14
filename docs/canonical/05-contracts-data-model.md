# 05 — Contracts & Data Model

## For a new developer

A contract describes business intent, not an ORM row. Before adding a field or endpoint, identify the caller, required input, permission check, state transition, persisted result, error behavior, idempotency rule and audit requirement. Keep IDs opaque, use explicit enums and preserve provenance.

For example, adapting a material creates a new variant linked to its source; it must not silently overwrite the original. Historical submissions and evidence must remain interpretable after later edits.

## Contract principles

- Frontend ↔ backend: REST API.
- Backend module ↔ module: application contracts.
- Contracts express business intent, not ORM/database rows.
- Use opaque IDs (UUID recommended).
- Prefer explicit enums over overlapping booleans.

## Key domain contracts

### Material
A material is a managed teaching resource, not necessarily a file. It has identity, academic metadata, source/provenance and lifecycle.

Adaptation creates a new variant/resource and preserves its parent/source relation.

### Question
A question has type, content, answer definition, difficulty, provenance and one or more skill mappings. Multi-skill mappings may use `PRIMARY` / `SECONDARY` roles and weights.

### Assessment / Assignment
Assessment composes reusable questions. Assignment decides which assessment is given to a student/class and when.

### Submission
Submission captures learner attempt lifecycle. `SubmissionResponse.response_payload` may be type-specific (MCQ, text, audio key, etc.).

### LearningEvidence
Evidence is source data—not an AI summary.

Minimum conceptual fields:

```text
learner_id
skill_id
question_id?
assessment_id?
submission_id?
evidence_type
observed_value?
normalized_score?
difficulty?
weight
observed_at
source_type
```

MVP evidence types:

```text
QUESTION_RESULT
RUBRIC_RESULT
TEACHER_EVALUATION
```

### LearnerSkillState

```text
learner_id
skill_id
score
confidence
evidence_count
first_evidence_at?
last_evidence_at?
computation_version
updated_at
```

Learner state is derived. Historical truth remains in `LearningEvidence`.

### Recommendation + TeacherDecision
Recommendation is advisory and stores the learner/state basis. Teacher decision is first-class data: `ACCEPT | MODIFY | REJECT` with optional modifications/reason.

### AI provenance
Store generation type/provider/model/time/source refs/status. Full rendered prompt is not mandatory and should not be persisted by default if it contains sensitive learner data.

## High-level data backbone

```text
User / Role
Course / Class / Enrollment
Skill / Level / Difficulty
Material / MaterialVersion / MaterialSkill
Question / QuestionSkill
Assessment / AssessmentItem / Assignment
Submission / SubmissionResponse
LearningEvidence
LearnerSkillState
Recommendation / RecommendationItem / TeacherDecision
AIGeneration
AuditEvent
```

## Source of truth

| Information | Source of truth |
|---|---|
| Material metadata | Material |
| Material binary | Object storage |
| Skill taxonomy | Taxonomy |
| Assessment definition | Assessment + AssessmentItem |
| Learner response | Submission + SubmissionResponse |
| Learning observation | LearningEvidence |
| Current learner state | LearnerSkillState |
| Historical basis | LearningEvidence |
| Recommendation | Recommendation |
| Teacher response | TeacherDecision |
| AI provenance | AIGeneration |
| Operational trace | AuditEvent |

Do not add generic workflow engines, payment/CRM/attendance models, RL trajectory state or complex graphs without stakeholder evidence.
