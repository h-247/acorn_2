# Acorn MVP screen inventory

The 20-screen inventory is intentionally a set of surfaces around the same core lifecycle—not 20 unrelated product domains.

## Global navigation

Teacher primary navigation:

```text
Home · Materials · Assessments · Classes · Learners
```

Student navigation is simpler and should not expose teacher/admin machinery.

## Batch A — Design language / core workflow

| # | Screen | Primary question |
|---:|---|---|
| A1 | Material Library | What approved asset can I find/reuse/adapt? |
| A2 | Material Detail | What is this material, where did it come from, and how was it used? |
| A3 | Question Bank | Which reusable English assessment item fits my need? |
| A4 | Assessment Builder | Is this assessment balanced and ready to publish? |
| A5 | Learner Profile | Where is this learner now and how confident is the evidence? |
| A6 | Evidence Explorer | Why does the learner state have this value? |
| A7 | Recommendation Workspace | What should the teacher consider doing next? |
| A8 | AI Content Review | What did AI create/change, and should the teacher approve it? |

Batch A establishes the Acorn UI grammar: list/detail, authoring workspace, evidence traceability, recommendation decision support and AI review semantics.

## Batch B — Operational workflow

| # | Screen | Purpose |
|---:|---|---|
| B1 | Teacher Home | Action-oriented home: pending review, classes, recent work, one meaningful insight |
| B2 | Material Create/Edit | Structure and publish an English learning asset |
| B3 | Material Adaptation & Version Compare | Create a new variant without overwriting source; compare changes |
| B4 | Question Editor | Author/review reusable skill-mapped assessment item |
| B5 | Assessment Detail / Publish / Assign | Inspect assessment state and assign to class/learner |
| B6 | Class Workspace | Current activities, class skill overview, learner attention |
| B7 | Submission Inbox | Teacher work queue for submitted assessments |
| B8 | Submission Review | Evaluate learner response/rubric and preview generated evidence |

## Batch C — Entry / learner experience

| # | Screen | Purpose |
|---:|---|---|
| C1 | Sign In | Friendly Acorn entry for English-center users |
| C2 | Learner Directory | Find learners and scan evidence/focus/attention state |
| C3 | Student Home / My Learning | What should I do next and how am I progressing? |
| C4 | Assessment Player | Complete English assessment with autosave/progress/navigation |

## Page vs drawer vs modal

**Full page/workspace:** material authoring/adaptation, question editor, assessment builder, submission review, learner profile, evidence explorer, recommendation, AI review.

**Drawer:** assign assessment, quick material/learner/evidence detail, lightweight metadata edit.

**Modal:** archive/reject/final submit/destructive confirmations.

## Cross-screen semantics

- `AI-generated` describes **origin**, not approval.
- `Approved` describes governance state.
- State/recommendation views must provide a path to evidence.
- `Accept recommendation` does not auto-assign an activity.
- The same status vocabulary must be used consistently per domain object.
