# 04 — Target Architecture & Responsibility Boundaries

## For a new developer

Follow a request from UI → REST endpoint → application service → domain/repository → PostgreSQL or object storage → response DTO. Each layer has a job. The frontend renders and collects input; the backend owns authorization and domain truth; storage adapters hide infrastructure details; AI is an optional assistive dependency.

Do not calculate learner state in a component, let the client decide permissions, write directly into another module's tables, or let a provider SDK leak into domain models. One deployable backend can still have strict internal boundaries.

## Target architecture

```text
Next.js Web
   │ REST
   ▼
Modular Monolith API
   ├── Identity & Access
   ├── Course / Class
   ├── Learning Material
   ├── Skill / Taxonomy
   ├── Assessment
   ├── Submission
   ├── Learning Evidence
   ├── Learner State
   ├── Recommendation
   ├── AI Assistance
   └── Audit / Metrics
      │              │
      ▼              ▼
 PostgreSQL     S3-compatible storage
      │
      └── AI provider adapter → external provider
```

Backend is authoritative for domain state, authorization, evidence, learner-state computation, recommendation state, approval and audit history.

## Modular monolith rule

Modules are domain-owned inside one deployable API. Prefer explicit application service contracts; avoid direct writes to another module's tables.

## Roles

```text
ADMIN
ACADEMIC_MANAGER
TEACHER
STUDENT
```

Backend must enforce both role and resource relationship.

## Module ownership

| Module | Primary ownership |
|---|---|
| Identity | users, roles, authentication/authorization context |
| Course/Class | course, class, enrolment, teacher-class relation |
| Material | metadata, versions/variants, provenance, storage linkage |
| Taxonomy | configurable skill hierarchy, level/difficulty vocabulary |
| Assessment | question, assessment, assignment configuration |
| Submission | learner attempts/responses/evaluation lifecycle |
| Evidence | normalized source-traceable observations |
| Learner State | current derived state from evidence |
| Recommendation | advisory next-focus/action objects |
| AI | generation/adaptation/explanation assistance only |
| Audit/Metrics | traceability + evaluation metrics |

## Core invariants

1. Learner state traces to evidence.
2. LLM output is not domain truth.
3. Teacher remains in the decision loop.
4. Material provenance survives reuse/adaptation.
5. Official domain logic lives in backend modules.
6. Skill taxonomy remains configurable.
7. MVP stays vertically focused on Material → Assessment → Evidence → State → Recommendation → Adaptation.
