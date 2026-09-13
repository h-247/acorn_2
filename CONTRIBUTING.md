# Contributing to Acorn

## Delivery model

Implement by **vertical slice**, not frontend/backend silos:

```text
user goal → UI → API → domain logic → persistence → audit → tests
```

Each slice should leave an end-to-end demonstrable flow.

## Before coding a feature

- Identify the canonical lifecycle segment it improves.
- Confirm module ownership and source of truth.
- Confirm authorization behavior.
- Define loading/empty/error/no-data states for UI.
- Define audit/metric events when the feature supports evaluation hypotheses.
- Check whether the change affects an ADR or core invariant.

## Pull-request checklist

- [ ] Domain ownership remains clear.
- [ ] No frontend duplication of official learner-state/recommendation logic.
- [ ] No provider SDK object leaks into domain contracts.
- [ ] AI-generated content cannot bypass teacher review.
- [ ] Evidence creation is idempotent where retries are possible.
- [ ] Authorization is enforced in backend, not only hidden in UI.
- [ ] UI respects readability/density rules.
- [ ] Unit/integration/authorization/failure tests are added where applicable.
- [ ] Canonical docs/ADR updated if the design decision changed.
