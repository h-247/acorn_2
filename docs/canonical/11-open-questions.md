# 11 — Open Questions

## For a new developer

This page is a decision queue, not a place to fill gaps with guesses. Each question should have an owner, evidence to collect, deadline/impact and the spec or seed data it will affect. A starting parameter such as MCQ first or recent-N=20 is not a permanent academic truth.

When a question is answered, record the decision and update the affected contract, test and implementation plan together. Keep non-blocking uncertainty visible rather than hiding it in code.

Core architecture/workflow decisions are frozen. The following should be resolved from stakeholder/pilot evidence instead of arbitrary developer choices.

1. Actual English-center skill/sub-skill taxonomy; CEFR/IELTS/internal framework relationship.
2. Exact semantic difference and vocabulary for learner/course level vs material/question difficulty.
3. First pilot assessment types (default: MCQ + short answer; bring Writing/Speaking earlier only if evidence supports it).
4. Writing/Speaking rubric → skill mapping and score ranges.
5. Current material organization (Drive/local/LMS, naming, volumes, licensed material, versioning).
6. Whether bulk import is required for pilot viability.
7. Required material provenance detail (publisher/edition/unit/license note/URL, etc.).
8. Baseline teacher effort/time metrics.
9. Business metric definitions for direct reuse, adaptation and new creation.
10. Which learner journeys/outcomes are available for reconstruction.
11. How teachers currently choose the next activity after reviewing results.
12. How formal course objectives need to be in v1.
13. Whether recommendations need a class-level use case beyond learner-level primitive state.
14. Operational policy for AI processing of licensed/copyrighted source material.
15. Pilot AI provider selection (quality/cost/privacy/reliability/structured output).
16. Whether prompt template/raw AI candidate/teacher-edited version need to be retained for research.
17. How much learner-state detail the learner sees.
18. Recommendation explanation: template/deterministic first; AI explanation optional enhancement.
19. Tune `recent-N` from sample data (`20` is only a starting parameter).
20. Exact rule for recommendation staleness.

## Must resolve before corresponding pilot

**Assessment pilot:** taxonomy v1, difficulty representation, first question types.<br>
**Writing/Speaking:** rubric, mapping, evaluation workflow.<br>
**Recommendation:** teacher decision factors, course constraints, presentation.<br>
**Business evaluation:** baseline metrics, definitions, participants and measurement protocol.

When resolved: stakeholder evidence → decision → spec update → implementation. Core invariant/boundary changes require architecture review/ADR.
