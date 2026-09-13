# ADR-0004 — AI Behind Provider-Independent Adapter

**Status:** Accepted

Domain/application modules call structured AI capabilities such as generate/adapt/explain through an internal interface. Provider SDK request/response objects must not leak into material/evidence/state/recommendation models.

Provider replacement should be infrastructure work, not a domain rewrite.
