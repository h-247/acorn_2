# 03 — Current State

## For a new developer

Greenfield means there is no legacy code or production schema to preserve; it does not mean there are no rules. Frozen decisions can be implemented now, while working assumptions must remain easy to revise and open questions must not be guessed.

BDC Hub is a selective implementation reference. Reuse generic UI/foundation assets only after checking Acorn's domain meaning, permissions and contracts. Do not import BDC-specific architecture just because its code already exists.

## Greenfield

There is no existing Acorn codebase, production schema, API contract, deployment topology, production data or legacy workflow that must be preserved.

This allows direct implementation toward the target domain model.

## Existing product knowledge

Known direction includes centralized learning materials, course/class/learner context, English skills, assessment and submission, finer-grained analysis than total score, AI-assisted generation/adaptation, learner progression and reduced teacher effort. These are still subject to stakeholder validation.

## BDC Hub reference

External reference:
- `Big-Data-Club/CoreApplication`
- `Big-Data-Club/BDCHub---Frontend`

### Prefer reuse
Generic tokens, buttons, inputs, forms, cards, tabs, layout/navigation and loading/empty/error states.

### Adapt
Course workspace, quiz configuration, teacher/student views, upload flows, analytics/visualization patterns.

### Reference only
Microservice decomposition, chat/lab services, Kafka, data warehouse, Kubernetes and other infrastructure not justified by Acorn MVP.

> Reuse implementation, not accidental architecture/domain assumptions.

## Starting direction

```text
Frontend       Next.js + TypeScript
Backend        Modular monolith
Database       PostgreSQL
Files/audio    S3-compatible object storage
AI             Provider-independent adapter
Auth           Application-managed identity + RBAC
```

If existing center data later needs import, treat it as ingestion—not as a reason to make legacy structures the core domain model.
