# 12 — UI Design System & Component Specification

## For a new developer

This is a UI behavior contract, not a screenshot to copy blindly. For each component define its purpose, input data, semantic states, user actions, permission, loading/empty/error/no-data behavior, responsive behavior and accessibility. Domain/API contracts outrank colors and layout.

Keep recommendation, learner state, AI origin and approval visually distinct. Preserve readability and progressive disclosure instead of shrinking type or hiding important evidence to fit one viewport.

## Product identity

**Acorn by Agentivium AI**<br>
Design thesis: **Clean institutional EdTech with modern AI accents.**

Mascot direction: a friendly squirrel used selectively in onboarding, student surfaces, empty states and light guidance—not as a replacement for evidence/status semantics.

Product feeling:

> Calm, structured, evidence-aware, academically trustworthy, and quietly AI-enabled.

## Core visual tokens

```text
Primary blue   #0967F7
Primary dark   #0758D8
Deep blue      #082051
Slate blue     #5969AB
Neutral gray   #656C79
Light surface  #F3F6FC
White          #FFFFFF
```

Typography: Switzer direction; fallback to Inter/system sans if Switzer is not shipped.

### App typography

```text
page-title     32–36 / 600
section-title  22–24 / 600
card-title     17–18 / 600
body           15–16 / 400
table-text     14–15
caption        13 minimum for non-critical metadata
```

> **Readability before density. Never shrink typography to fit more cards/rows into one viewport.**

## Layout and density

- sidebar: ~232–256px;
- top bar: 64–72px;
- content max width: ~1440px;
- default 12-column grid, 16–24px gaps;
- teacher UI: medium density, information-rich but visually relaxed;
- student UI: low–medium density, progress/next-action first;
- show 4–5 primary filters; move the rest under `More filters`;
- teacher tables generally show 6–7 visible data columns max;
- normal row height 52–60px;
- vertical scrolling is acceptable; do not force all information above the fold.

## Component construction

```text
Anatomy
→ Variants
→ Sizes/Density
→ States
→ Interaction
→ Semantic contract
```

Use semantic APIs such as `StatusBadge(status="approved")`, not color-driven APIs.

### UI layers

```text
ui/        primitives
patterns/  interaction patterns
features/  domain-semantic compositions
```

## Important domain components

- `MaterialRow/MaterialCard`: title, type, skill, level/difficulty, source/provenance, lifecycle state, usage and contextual actions.
- `LearnerSkillCard`: skill, score/state, confidence, evidence count, progression and drill-down.
- `EvidenceItem`: observed skill/result/source/difficulty/time/evaluator.
- `RecommendationPanel`: focus, priority, target difficulty, suggested action, candidate material, evidence basis and teacher decisions.
- `AICandidateReview`: AI candidate → teacher edit/review → approve/reject; AI origin must remain distinct from approval state.

## Data viz grammar

Prefer horizontal bars, line trends, timelines, simple distributions and lineage. Avoid decorative rainbow gauges, excessive radar charts and one-number learner scores without evidence drill-down.

## States

Every data component must consider loading, empty, error and insufficient-evidence/no-data separately.

## Mascot placement

Appropriate: sign-in/onboarding, student home, friendly empty states, light helper cards.<br>
Avoid mascot decoration in Evidence Explorer, Submission Review, Assessment Builder and other serious dense teacher workflows.

## Responsive target

Desktop is primary for teacher/academic-manager authoring. Student surfaces should respond well to smaller widths. Mobile teacher authoring does not need desktop feature parity.
