# ADR-0004 — AI Behind Provider-Independent Adapter

**Status:** Accepted

Domain/application modules call structured AI capabilities such as generate/adapt/explain through an internal interface. Provider SDK request/response objects must not leak into material/evidence/state/recommendation models.

Provider replacement should be infrastructure work, not a domain rewrite.

**Non-AI Local Deployment Note:**
In the local zero-cost non-AI distribution (per `LOCAL-NON-AI-IMPLEMENTATION-PLAN.md`), all AI execution routes, mock AI adapters, and AI review screens are excluded. Core business loops use deterministic rule-based recommendations (`REUSE` / `ADAPT` / `NO_MATCH`), manual authoring and adaptations, and deterministic grading.
