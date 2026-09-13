# 10 — Test Plan, Acceptance Tests & Definition of Done

## Testing principle

Prioritize domain correctness and end-to-end traceability over raw line coverage.

```text
user action
→ domain state
→ persistence
→ derived state
→ authorization
→ audit
```

Test families: unit, integration, authorization, workflow, failure/retry, AI contract and evaluation metrics.

## Mandatory deterministic tests

- taxonomy tree validity;
- evidence normalization `[0,1]`;
- multi-skill weights;
- learner-state weighted average + recent-N + confidence boundaries;
- `NO_DATA` semantics;
- recommendation eligibility/course override/reuse-adapt-generate fallback.

## Critical integration/failure tests

- material create/search/adapt retains provenance;
- assessment → assignment → submission → evaluation;
- evaluated submission → evidence → state exactly once;
- student cannot access another student's submission;
- teacher scope enforced;
- invalid lifecycle transitions fail;
- used questions/assessments cannot be destructively changed;
- duplicate submit/retry is idempotent;
- evidence generation is idempotent;
- evidence correction recomputes state and preserves audit;
- state update can recover from persisted evidence;
- AI timeout/invalid schema leaves core state unchanged;
- AI candidate cannot be assigned before approval;
- protected object access denied when unauthorized.

## Canonical acceptance flow

```text
Teacher creates/imports material
→ tags skill/level
→ creates assessment
→ assigns learner
→ learner submits
→ evidence generated
→ learner state updated
→ recommendation generated
→ teacher reviews
→ reuse/adapt/generate selected
→ teacher approves
→ next activity created
```

Every transition must be backed by persisted domain state.

## Feature DoD

A feature is not done until applicable items exist:
- business behavior;
- backend authorization;
- persistence migration/schema;
- documented API contract;
- loading/empty/error UI states;
- unit/integration tests;
- audit event;
- tested failure behavior;
- staging/demo readiness.

## MVP DoD

Must demonstrate:
1. core vertical loop;
2. traceability (state→evidence, recommendation→state, material→source, AI→approver);
3. teacher-in-the-loop enforcement;
4. business evidence collection;
5. small pilot readiness.

Not required: full LMS, mobile app, payments, attendance, advanced anti-cheating, advanced knowledge tracing, microservices/Kafka, multi-tenant SaaS or marketing platform.
