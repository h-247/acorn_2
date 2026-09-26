# Acorn – Local Setup & Demo Rehearsal Guide

> **For thesis-defense preparation.** This guide lets you reproduce every mandatory demo flow reproducibly on a clean machine.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS or 22 LTS |
| pnpm | 9.x (`npm i -g pnpm`) |
| Docker Desktop | 24+ (or any Docker with Compose v2) |
| Playwright browsers | installed via `pnpm exec playwright install chromium` |

---

## 1. First-Time Setup

```bash
# 1. Clone & install
git clone <repo-url>
cd "Codex - acorn"
pnpm install

# 2. Copy env
cp .env.example .env          # edit if needed (defaults work out of the box)

# 3. Start infrastructure (Postgres 5435, SeaweedFS S3 8333)
docker compose -f compose.dev.yml up -d --wait

# 4. Run DB migrations
pnpm --filter @acorn/api db:migrate

# 5. Seed the demo database
pnpm --filter @acorn/api db:seed
```

---

## 2. Running the Application

Open **two terminals**:

```bash
# Terminal 1 — API (http://localhost:4000)
pnpm --filter @acorn/api dev

# Terminal 2 — Web (http://localhost:3000)
pnpm --filter @acorn/web dev
```

---

## 3. Demo Accounts (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@acorn.edu` | `admin123` |
| Teacher | `taylor@acorn.edu` | `password123` |
| Student | `emma.nguyen@student.acorn.edu` | `password123` |
| Student | `liam.chen@student.acorn.edu` | `password123` |

---

## 4. Four-Skill Demo Flows

### Flow A – Reading (MCQ auto-graded)

1. **Admin / Teacher** → go to `http://localhost:3000` → create a question (`READING`, type `MCQ`, add options and correct answer) → create assessment → publish → assign to class.
2. **Student** (`emma.nguyen`) → go to `/student/assessments` → click **Open Player** → **Start Attempt** → select the MCQ option → click **Submit assessment** → confirm.
3. **Teacher** → `/submissions` → find Emma's submission → review → the MCQ is auto-graded (✓ / ✗ visible). Click **Save & Create Evidence** to commit learning evidence.
4. **Student** → revisit the submission from `/student/assessments` → see the read-only evaluated result with score and correct answer.

### Flow B – Writing (teacher rubric)

1. **Admin / Teacher** → create a `WRITING` question with rubric criteria (e.g., _Content 10pts_, _Grammar 5pts_) → include in an assessment → publish → assign.
2. **Student** → open the player → type the essay into the text area → submit.
3. **Teacher** → `/submissions/<id>/review` → fill in rubric scores for each criterion → add teacher feedback → click **Save & Create Evidence**.
4. **Learner profile** (`/learners/<id>`) → verify the Writing skill evidence entry appears in the Progress Trend chart and Evidence table.

### Flow C – Speaking (audio upload + rubric)

1. **Admin / Teacher** → create a `SPEAKING` question with rubric → include in assessment → publish → assign.
2. **Student** → open player → click **Record** → allow microphone → speak → stop → upload → click **Submit assessment**.
3. **Teacher** → `/submissions/<id>/review` → click the audio play button next to the speaking question to confirm protected access → fill rubric → save evidence.
4. **Learner profile** → Speaking skill evidence appears.

> **Note:** Audio upload requires a microphone. In a headless environment, upload a `.webm` or `.ogg` file manually via the file input that appears when `Record` is not available.

### Flow D – Listening (linked material audio + auto-graded MCQ)

1. **Admin / Teacher** → upload a material of type `AUDIO` (via `/materials/new`) → approve the material.
2. Create a `LISTENING` question → in the **Source Material** dropdown → link the audio material → add MCQ options and a correct answer → include in assessment → publish → assign.
3. **Student** → open the player → the left panel shows the linked audio file from the material (download/play button visible) → select the MCQ answer → submit.
4. **Teacher** → the MCQ is auto-graded. Generate evidence and verify the Listening skill entry on the Learner Profile.

---

## 5. Recommendation & Teacher Decision Flow

After evidence is created from any submitted evaluation:

1. **Teacher** → go to `/learners/<id>/recommendation` → view the auto-generated evidence-grounded recommendation (target skill, CEFR level, rationale bullets, candidate materials).
2. Click **Accept** or **Reject** → add teacher notes → select a material if accepting.
3. **Student** → go to `/student` → the accepted recommendation card appears with the teacher's selected material and rationale.

---

## 6. Resetting the Demo Database

**WARNING: This only works for the development database (`acorn`). The test database (`acorn_test`) is reset automatically before each test run.**

```bash
# Wipe all application data and re-seed (safe: only targets localhost:5435/acorn)
pnpm --filter @acorn/api db:reset
```

---

## 7. Running Tests

```bash
# Backend integration + unit tests (isolated test DB acorn_test)
pnpm --filter @acorn/api test

# Frontend E2E Playwright tests (launches full stack in test mode)
pnpm --filter @acorn/web test:e2e
```

All tests use the `acorn_test` database and `acorn-test` object storage bucket. They **never touch** the demo database or `acorn-dev` bucket.

---

## 8. Key URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Teacher home |
| `http://localhost:3000/student` | Student portal |
| `http://localhost:3000/assessments/builder` | Assessment builder |
| `http://localhost:3000/materials/new` | Create a material |
| `http://localhost:3000/submissions` | Submission inbox (teacher) |
| `http://localhost:3000/learners` | Learner list & profiles |
| `http://localhost:4000/api/docs` | OpenAPI / Scalar docs |

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED 5435` | `docker compose -f compose.dev.yml up -d` |
| `relation "users" does not exist` | `pnpm --filter @acorn/api db:migrate` |
| Audio upload fails | Ensure SeaweedFS is running: `docker ps \| findstr seaweedfs` |
| Playwright timeout | Run `pnpm exec playwright install chromium` then retry |
| MCQ publish blocked (400) | Every MCQ question attached to the assessment must have at least 2 options and a `correctAnswer` set |
