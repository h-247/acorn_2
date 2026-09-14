# 08 — Design Rationale

## For a new developer

This document explains why the frozen decisions exist and what trade-off they accept. A decision is not an excuse to copy one implementation forever: keep the invariant, but revisit the decision only when new evidence, scale, ownership or reliability needs justify the cost.

When proposing a change, state the current problem, evidence, affected invariant, migration/test/operational cost and the spec/ADR that must change. Do not replace deterministic domain rules with an LLM merely because the demo looks more natural.

## Frozen decisions

| Decision | Selected |
|---|---|
| Architecture | Modular monolith |
| Frontend | Next.js + TypeScript |
| Structured persistence | PostgreSQL |
| Binary storage | S3-compatible object storage |
| Learner state | deterministic evidence aggregation |
| Evidence window | configurable recent-N |
| Difficulty | stored/contextual, not calibrated into state score v1 |
| Recommendation | structured heuristic + optional AI explanation |
| Adaptation | teacher-in-the-loop |
| Content strategy | Reuse → Adapt → Generate |
| Taxonomy | configurable hierarchy |
| Question mapping | one/multiple weighted skills |
| AI integration | provider-independent capability boundary |
| Assessment history | restrict destructive edit after use |
| Async infrastructure | deferred unless justified |
| BDC Hub | selective reuse |
| Evaluation | instrumented workflow + stakeholder feedback |

## Why modular monolith

The MVP must spend complexity budget on evidence, state, recommendation, provenance and teacher workflow—not service discovery, brokers, distributed consistency or deployment topology.

## Why deterministic learner state

LLM-first learner analysis is easy to demo but hard to reproduce, audit and explain. Structured evidence aggregation gives a transparent baseline and keeps future algorithms replaceable.

Advanced BKT/DKT/cognitive diagnosis/IRT are deferred until there is suitable data and an evaluation reason.

## Why recent-N

All-history overweights old behavior; time windows can starve low-frequency learners. Recent-N is simple and explainable for v1.

## Why teacher-in-the-loop

Fully autonomous adapt/generate/assign creates academic risk and scope explosion. Acorn reduces teacher effort but preserves professional judgment.

## Why reuse-first

Always generating new content creates duplicates, more review work and less institutional memory. Reuse and adaptation maximize value from approved assets.

## Trade-offs accepted

- simplicity over infrastructure sophistication;
- explainability over model sophistication;
- human oversight over full automation;
- evidence quality over quantity;
- vertical depth over LMS breadth.

Changing a frozen decision should be reviewed as a design decision/ADR, not a coding convenience.
