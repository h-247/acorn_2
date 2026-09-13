# ADR-0001 — Monorepo + Modular Monolith

**Status:** Accepted

## Decision

Acorn starts as one monorepo with one web app and one modular-monolith API. Domain boundaries are enforced internally before deployment boundaries are introduced.

## Why

The MVP needs complexity budget for evidence, learner state, material provenance, recommendation and teacher workflow—not distributed-system operations.

## Consequence

Do not create separate repos/services such as `acorn-ai-service` or `acorn-recommender` without concrete scaling/ownership evidence.
