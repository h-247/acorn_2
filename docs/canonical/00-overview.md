# Acorn — Technical Design Overview

## For a new developer

This is the map of the product. Read it before opening a module or building a screen. Acorn is not just a file library and not an autonomous AI tutor: the important path is material → learning activity → evidence → learner state → teacher decision. The linked canonical documents define each part of that path.

If you are unsure where a feature belongs, ask which step it supports, which actor owns the decision, and which persisted data lets another developer explain the result later.

## Product

**Acorn by Agentivium AI**<br>
Working tagline: **Every class makes your teaching smarter.**

Acorn is a greenfield MVP for an English center. It treats learning materials as institutional assets that become more valuable through reuse, adaptation, learning evidence, and teacher decisions.

## North Star

> Biến học liệu từ một tài nguyên có thể mua giống nhau trên thị trường thành một tài sản tri thức riêng của trung tâm, được cải tiến liên tục dựa trên dữ liệu học tập và kinh nghiệm của giáo viên.

## Canonical loop

```text
Material
→ Assessment
→ Learner Activity
→ Learning Evidence
→ Learner State
→ Recommendation
→ Teacher Decision
→ Reuse / Adapt / Generate
→ Next Learning Activity
```

## Product value

**Operational efficiency**
- reduce material search/preparation effort;
- reduce assessment authoring/adaptation effort;
- make previously approved assets easier to reuse.

**Institutional differentiation**
- retain learner evidence;
- retain teacher-approved adaptations;
- retain material usage/provenance;
- reconstruct learner progression;
- accumulate teaching intelligence across cohorts.

## Architecture snapshot

- frontend: Next.js + TypeScript;
- backend: modular monolith;
- structured persistence: PostgreSQL;
- binary storage: S3-compatible;
- AI: provider-independent application boundary;
- AI role: assistive, teacher-in-the-loop;
- deployment: portable local/cloud/on-prem.

## Scope guard

Acorn is **not** a generic LMS, CRM, marketing platform, autonomous adaptive-learning system, or microservice showcase.
