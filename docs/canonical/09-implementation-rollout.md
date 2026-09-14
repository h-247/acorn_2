# 09 — Implementation Plan & Rollout

## For a new developer

Build vertical slices, not isolated layers. A slice is only complete when a real use case crosses UI, API, authorization, domain logic, persistence, audit/metrics and automated tests. Seed data can help a screen render, but it must not be mistaken for production truth.

Each phase needs a demoable happy path, negative/permission path, retry behavior and an explicit list of assumptions or unfinished work. Stakeholder evidence collection runs alongside implementation so uncertain taxonomy and workflow details are refined deliberately.

## Delivery principle

Deliver vertical slices:

```text
use case → UI → API → domain logic → persistence → audit → test
```

Do not build all DB, then all backend, then all frontend.

## Parallel stakeholder evidence track

During the first week collect current workflow, teacher preparation effort, time-to-find/create/adapt, real materials/assessments, skill taxonomy, representative learner journeys and privacy/content constraints. This refines configuration/pilot behavior but does not block foundation work.

## Phases

0. **Foundation** — repo/app shell, modular-monolith skeleton, PostgreSQL, S3-compatible storage, auth foundation, logging/migrations.
1. **Identity / Academic Structure / Taxonomy** — user/role/course/class/enrollment/skills/level/difficulty.
2. **Material Repository** — upload/create, metadata, search/filter, archive, provenance, variants, initial metrics.
3. **Question & Assessment Authoring** — reusable questions, skill/difficulty mapping, assessment composition/publish.
4. **Assignment / Submission / Evaluation** — assign, autosave, submit, deterministic grade, teacher evaluation.
5. **Learning Evidence Pipeline** — normalized source-traceable evidence, idempotency.
6. **Learner State** — recent-N weighted state, confidence, progression/evidence drill-down.
7. **Recommendation** — structured focus/action/candidate materials, teacher accept/modify/reject.
8. **AI Assistance** — generation/adaptation candidates, validation, teacher review/approval.
9. **Learning Journey & Business Evidence** — teacher-effort, reuse, AI/recommendation acceptance and traceability evaluation.

## Recommended order

```text
Foundation
→ Identity/Academic
→ Material
→ Assessment
→ Submission
→ Evidence
→ Learner State
→ Recommendation
→ AI Assistance
→ Evaluation
```

Do not start AI-first.

## Pilot rollout

```text
Local Development
→ Shared Development
→ Staging/Internal Demo
→ Small Pilot (1–3 teachers, 1–2 classes)
```

## MVP completion

The MVP is complete when the canonical loop works end-to-end with traceability and enough operational evidence to evaluate value—not when a target number of screens has been implemented.
