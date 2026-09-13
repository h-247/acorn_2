# `apps/api`

Acorn backend is a **modular monolith**. The exact framework remains an explicit open technical choice; do not select it accidentally through a generated scaffold.

## Domain modules

```text
identity
course
material
taxonomy
assessment
submission
evidence
learner-state
recommendation
ai
audit
```

Modules communicate through application contracts. A module must not directly mutate another module's persistence state.

The API must remain container-compatible and portable across local, cloud pilot, and on-prem deployments.
