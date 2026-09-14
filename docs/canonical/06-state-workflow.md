# 06 — State & Workflow

## For a new developer

Do not collapse raw activity, learning evidence, learner state and recommendation into one AI step. For every transition write down current state + allowed actor/action + validation → next state + audit. This makes retries, forbidden actions and recovery behavior testable.

Remember that `NO_DATA` is not poor performance, `AI-generated` is not approval, and a recommendation is not an assignment. These distinctions must exist in both API responses and UI states.

## Canonical separation

```text
Raw Activity
→ Learning Evidence
→ Learner State
→ Recommendation
```

Do not collapse this into one opaque AI step.

## Main loop

```text
Material
→ Question/Assessment
→ Assignment
→ Attempt/Submission
→ Evaluation
→ Evidence
→ Learner State
→ Recommendation
→ Teacher Review
→ Reuse / Adapt / Generate
→ Next Activity
```

## Lifecycles

### Material
Manual: `DRAFT → ACTIVE → ARCHIVED`<br>
AI/adapted: `GENERATED → UNDER_REVIEW → APPROVED → ACTIVE`, with rejection possible.

### Assessment
`DRAFT → READY → PUBLISHED → CLOSED`

### Submission
`STARTED → IN_PROGRESS → SUBMITTED → EVALUATING → EVALUATED`

## Evidence normalization

Evidence used for current state should normalize into `[0,1]`; raw values remain available for audit.

Difficulty is stored and used for filtering/context/recommendation, but does **not** directly calibrate learner-state score in v1.

## Learner state v1

Weighted average over configurable recent-N valid evidence per skill.

```text
score = Σ(score × weight) / Σ(weight)
```

Start with `N=20` as an implementation parameter, not an academic constant.

Confidence v1:

```text
0 evidence → NO_DATA
1–2        → LOW
3–5        → MEDIUM
6+         → HIGH
```

`NO_DATA` must never be displayed as weakness or zero performance.

## Recommendation

Use deterministic pre-processing before optional AI explanation:

```text
Learner State
→ identify eligible focus
→ apply course/teacher constraints
→ search approved repository
→ structured recommendation
→ optional explanation
```

Default content strategy:

```text
Reuse → Adapt → Generate
```

Recommendation does not equal assignment. Teacher accepts/modifies/rejects.

## AI generation/adaptation

```text
Structured request
→ provider
→ candidate
→ schema validation
→ teacher review/edit
→ approve/reject
→ normal domain resource
```

AI provider failure must not block manual/reuse flows.

## Recovery rules

If evidence persists but learner-state recompute fails, evidence remains authoritative and state can be recomputed. If AI fails, domain state remains intact.
