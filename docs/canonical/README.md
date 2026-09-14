# Canonical Acorn specification

This directory contains Acorn's versioned product and technical specification. It is the source of truth for implementation together with the architecture decision records under `docs/adr/`.

Keep these documents self-contained and update them in the same change when a product or technical decision changes.

## How to use these specs as a new developer

These documents are implementation guidance, not a list of slogans or database tables. Read `00-overview.md` first, then follow the order in the table below. For a feature, start from the user-visible use case and trace it through the relevant contract, state transition, persistence, authorization, failure behavior and acceptance test.

When a sentence says **must**, treat it as a contract. When it says **starting direction**, **recommended** or **open question**, do not silently turn it into a permanent product decision. Ask for evidence or record the decision in the appropriate spec/ADR.

The authority order is:

```text
domain/API contract
→ lifecycle and permission rules
→ UX/UI behavior
→ design system
→ mockup or implementation convenience
```

Every end-to-end feature should be explainable as:

```text
user action
→ API/application service
→ authoritative data
→ derived data (if any)
→ audit/metrics
→ UI state and acceptance test
```

Do not use a mock, an LLM response, a frontend-only check or a database row as a substitute for the relevant contract.

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
