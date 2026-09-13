# Source of truth

## Repository canonical specification

`docs/canonical/` is the versioned product and technical specification for Acorn. It is available directly to every developer alongside the code.

Architectural decisions are recorded in `docs/adr/`.

## Update rule

When a core design decision changes:

1. resolve the decision with evidence/review;
2. update the affected `docs/canonical/` specification;
3. add/update an ADR if the decision is architectural;
4. then implement.

Do not let code convenience silently override canonical decisions.
