# 07 — Failure, Security & Observability

## For a new developer

First classify data as authoritative, derived or external/best-effort. Preserve authoritative submissions, evidence and teacher decisions; recompute derived learner state and recommendations; expose AI failure without corrupting domain state. Design every retry so a timeout cannot create a second logical attempt or evidence record.

Frontend visibility is not security. The backend must check role plus resource relationship, and logs must avoid secrets and unnecessary learner content. A useful error state tells the user what failed, what is safe, and whether to retry or continue manually.

## Consistency model

Priority:

```text
durable core state
+ recoverable derived state
+ best-effort external AI
```

Authoritative: material, question, assessment, assignment, submission/response, evidence, teacher decision.<br>
Derived: learner state, recommendation, analytics aggregates.

### Reliability rules

- final submission only after responses are persisted;
- duplicate submit for same attempt is idempotent;
- retry must not duplicate evidence;
- learner state can be stale temporarily but must recompute;
- recommendation/AI failure cannot corrupt authoritative state;
- AI invalid schema never creates official material/question;
- material upload failure leaves resource draft/failed, not active;
- archive before destructive physical deletion;
- restrict destructive edits to questions/assessments already used in evaluated submissions;
- evidence corrections must audit old/new actor/time and recompute affected state;
- recommendations may become stale when based-on state changes.

## Security

Protected data includes identity, academic data, learner evidence, writing/audio submissions and teaching content.

### Roles + resource authorization

RBAC is the baseline, but role alone is insufficient. Teachers only access assigned/authorized classes and learners; students only access their own/assigned resources.

Backend authorization is authoritative. Hidden buttons/client checks are not security boundaries.

### AI data boundary

Send the **minimum necessary context** to AI. Do not send names/emails/account metadata when a structured anonymous learner context is sufficient.

### File access

Audio/writing/material assets should be private objects accessed through authorized backend paths or short-lived signed URLs. Do not expose an entire storage bucket publicly.

### Multi-tenancy

MVP is single-center. Do not add tenant IDs/billing/isolation infrastructure preemptively.

## Observability

Request logs: request ID, actor when authenticated, route/action, status, latency, timestamp. Never log passwords/tokens/full sensitive content by default.

Track domain IDs across assessment/evidence/recommendation/AI flows.

Key product/evaluation metrics:
- material created/reused/adapted/searches;
- assessments/assignments/submissions;
- evidence/state updates;
- recommendations generated/accepted/modified/rejected;
- AI request success/failure/latency + accepted/modified/rejected;
- material search/adaptation/assessment authoring/review durations.

Teacher-facing evidence/recommendation trace views are more important than decorative AI explanations.
