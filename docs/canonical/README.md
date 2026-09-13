# Canonical Acorn specification

This directory contains Acorn's versioned product and technical specification. It is the source of truth for implementation together with the architecture decision records under `docs/adr/`.

Keep these documents self-contained and update them in the same change when a product or technical decision changes.

| File | Scope |
|---|---|
| `00-overview.md` | North Star, scope, canonical loop |
| `01-context-problem.md` | Problem/business motivation |
| `02-goals-non-goals.md` | MVP goals and guardrails |
| `03-current-state.md` | Greenfield state + BDC reuse boundary |
| `04-architecture-boundaries.md` | Target architecture + module ownership |
| `05-contracts-data-model.md` | Contracts + source-of-truth model |
| `06-state-workflow.md` | Lifecycles, evidence/state/recommendation workflow |
| `07-failure-security-observability.md` | Reliability, security, metrics |
| `08-design-rationale.md` | Selected alternatives/trade-offs |
| `09-implementation-rollout.md` | Vertical-slice implementation plan |
| `10-test-acceptance-dod.md` | Tests, acceptance and DoD |
| `11-open-questions.md` | Stakeholder/pilot questions |
| `12-ui-design-system.md` | Acorn UI contract |
| `13-deployment-portability.md` | PostgreSQL/R2/MinIO/Cloudflare strategy |
