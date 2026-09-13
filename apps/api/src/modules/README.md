# Module ownership

| Module | Owns |
|---|---|
| identity | users, roles, auth/authorization context |
| course | courses, classes, enrolment, teacher-class relationship |
| material | material metadata, versions/variants, provenance, storage linkage |
| taxonomy | skill hierarchy, levels, difficulty vocabulary |
| assessment | questions, assessment structure, assignment configuration |
| submission | learner attempts, responses, evaluation lifecycle |
| evidence | normalized traceable learning observations |
| learner-state | current derived skill state, recomputation |
| recommendation | advisory next-focus/action objects |
| ai | provider-independent generation/adaptation/explanation boundary |
| audit | critical events and operational/value metrics |

Source-of-truth and boundary details are in `docs/canonical/04-contracts-data-model.md` and `docs/canonical/03-architecture-boundaries.md`.
