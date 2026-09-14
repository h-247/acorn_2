# 02 — Goals & Non-goals

## For a new developer

Goals describe what the MVP must prove; non-goals protect the team from scope drift. Convert a goal into a capability, persisted data and an acceptance scenario. For example, “structured evidence” requires source, skill, score and time—not merely an Evidence table or a number printed in the UI.

If a new request conflicts with a non-goal, record the impact and get a scope decision before changing architecture. “The model can do it” is not enough reason to add autonomous behavior.

## Goals

### G1 — Semantic learning-material management
Organize materials by course/program, level, skill/sub-skill, topic, difficulty, type, source and version so teachers can search, reuse and adapt rather than recreate.

### G2 — Structured traceable learning evidence
Minimum evidence can include assessment/question/rubric result, skill, difficulty, attempt context, teacher evaluation, related material and timestamp.

### G3 — Learner state + teacher-facing recommendation
The system may summarize evidence into skill-level state and propose a focus/difficulty/content action. Teacher must be able to **accept, modify or reject** recommendations.

### G4 — Reduce preparation effort
Shift teacher work from manual content production toward review and instructional decision-making.

### G5 — Build institutional learning knowledge
Retain materials, variants, questions, AI candidates, usage, evidence, progression, interventions and outcomes so experience survives beyond individual teachers.

### G6 — Measurable business value
Instrument teacher preparation time, time-to-find, time-to-create/adapt, reuse rate, AI acceptance/edit/reject and recommendation decisions.

### G7 — Reconstructable learner journey
Support a traceable path from initial assessment through evidence/state/interventions to later outcome.

## Non-goals

- full generic LMS (forum, chat, video meeting, payment, attendance, timetable, etc.);
- CRM/marketing platform;
- autonomous learning path without teacher review;
- advanced learner modeling as an MVP requirement;
- LLM as source of truth for learner state;
- direct AI output → published/assigned content;
- advanced anti-cheating/proctoring;
- enterprise/multi-region reliability;
- causal claim that a material caused a score improvement;
- copying the whole BDC Hub product/architecture.

## MVP success boundary

A successful MVP demonstrates end-to-end:

```text
teacher adds/imports material
→ structure by skill/level
→ build/generate assessment
→ learner submission
→ structured evidence
→ learner state
→ recommendation
→ teacher decision
→ next activity
```

Every major step must be traceable to persisted domain state.
