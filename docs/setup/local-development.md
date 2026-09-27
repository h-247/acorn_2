# Local Development Guide (Non-AI Acorn Profile)

## Overview

Acorn runs 100% locally with zero paid cloud services or artificial AI mockups. This setup delivers authoritative persistence in PostgreSQL, local S3-compatible object storage via SeaweedFS, deterministic rule-based recommendations, and complete Teacher, Student, and Academic Admin workflows across 19 screens.

## Prerequisites

- **Node.js**: >= 20.x
- **pnpm**: >= 9.x
- **Docker Desktop**: Running locally on Windows

## Infrastructure Setup

Acorn uses Docker Compose (`compose.dev.yml`) to provide isolated, free local infrastructure:
- **PostgreSQL 16**: Port `5435` (mapped from 5432 internally to avoid port conflicts with host databases)
- **SeaweedFS S3**: Port `8333` (S3 API endpoint), Port `9333` (Master management)

### 1. Configure Environment

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Default local environment values:
```env
WEB_ORIGIN=http://localhost:3000
POSTGRES_PORT=5435
DATABASE_URL=postgresql://acorn:acorn_dev_only@localhost:5435/acorn
OBJECT_STORAGE_ENDPOINT=http://localhost:8333
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_BUCKET=acorn-materials
OBJECT_STORAGE_ACCESS_KEY_ID=acorn
OBJECT_STORAGE_SECRET_ACCESS_KEY=acorn_dev_only
JWT_SECRET=dev-jwt-secret-acorn-local-token-32b
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 2. Start Local Containers

Start the containers in the background:

```powershell
docker compose -f compose.dev.yml up -d
```

Verify that both containers are healthy:

```powershell
docker compose -f compose.dev.yml ps
```

Expected output:
- `acorn-postgres` (healthy on `0.0.0.0:5435->5432/tcp`)
- `acorn-seaweedfs` (healthy on `0.0.0.0:8333->8333/tcp, 0.0.0.0:9333->9333/tcp`)

### 3. Install Dependencies

```powershell
pnpm install
```

### 4. Database Migrations & Authoritative Seed

Run Drizzle migrations to generate the 22 relational tables, followed by the idempotent seed script:

```powershell
pnpm --filter @acorn/api db:migrate
pnpm --filter @acorn/api db:seed
```

The seed script initializes real hashed passwords using `scrypt`, demo curriculum taxonomy (skills hierarchy), CEFR B1 courses and classes, materials with versions and provenance, assessment questions with answer keys, sample assignments, student submissions, and baseline learning evidence.

### 5. Start Development Servers

Run the backend Fastify API (port 4000) and frontend Next.js application (port 3000):

```powershell
# Terminal 1 - Fastify API
pnpm --filter @acorn/api dev

# Terminal 2 - Next.js Web
pnpm --filter @acorn/web dev
```

Visit the application at [http://localhost:3000](http://localhost:3000).

## Demo Accounts

All demo accounts are pre-seeded with password `password123`:

| Role | Email | Password | Primary Workflow |
| :--- | :--- | :--- | :--- |
| **Teacher** | `taylor@acorn.edu` | `password123` | Dashboard, Material Authoring/Adaptation, Question Bank, Assessment Builder, Submissions Evaluation, Evidence Explorer, Recommendation Workspace |
| **Student** | `emma.nguyen@student.acorn.edu` (or `emma@acorn.edu`) | `password123` | Student Portal, Assigned Assessments, Split-Screen Assessment Player, Progress Snapshot |
| **Admin** | `admin@acorn.edu` | `admin123` | User Management, Class & Course Management, Skills Taxonomy, Pilot Metrics |

## Dữ liệu diễn tập bảo vệ bốn kỹ năng

Sau khi chạy migration, nạp lại bộ dữ liệu demo bằng:

```powershell
pnpm --filter @acorn/api db:seed
```

Seed chạy lặp được: các ID cố định được cập nhật tại chỗ và không tạo thêm submission, evidence hoặc audit event trùng lặp.

| Vai trò / tài khoản | Dữ liệu chuẩn bị sẵn để trình diễn |
| :--- | :--- |
| Admin — `admin@acorn.edu` / `admin123` | Course, lớp, 10 học viên, taxonomy và audit trail của luồng demo. |
| Teacher — `taylor@acorn.edu` / `password123` | Bốn assessment đã publish, assignment đang mở; Liam có bài Writing chờ chấm; các bài Writing của Emma, Speaking của Sofia và Listening của Noah đã có kết quả/evidence để xem review, learner state và recommendation. |
| Emma — `emma.nguyen@student.acorn.edu` / `password123` | Đã hoàn thành Reading và Writing; xem feedback, tiến độ và recommendation Reading. |
| Liam — `liam.chen@student.acorn.edu` / `password123` | Writing đã nộp, chờ giáo viên rubric grading. |
| Sofia — `sofia.rodriguez@student.acorn.edu` / `password123` | Speaking đã được giáo viên chấm rubric; dữ liệu seed chỉ lưu transcript/rubric, không giả mạo file ghi âm. |
| Noah — `noah.dubois@student.acorn.edu` / `password123` | Listening đã được auto-grade sai một câu và có recommendation luyện nghe. |
| Lucas — `lucas.kim@student.acorn.edu` / `password123` | Listening đang làm, có đáp án autosave nhưng chưa nộp. |

Listening có hàng metadata `audio/mpeg` trong database để assessment hợp lệ về quan hệ dữ liệu. File seed không tự tạo một object MP3 rỗng trong object storage vì URL ký cho object đó sẽ không phát được. Khi cần trình diễn phát âm thanh thật, chạy browser E2E `pnpm --filter @acorn/web test:e2e`; kịch bản này upload fixture MP3 thật vào bucket `acorn-test` và kiểm tra playback có ủy quyền.

## Testing & Verification

Run the comprehensive unit and integration test suite:

```powershell
# Run all tests across the repository
pnpm test

# Run API package tests directly
pnpm --filter @acorn/api test

# Typecheck and build all packages
pnpm build

# Lint frontend web application
pnpm --filter @acorn/web lint
```

## Non-AI Profile Architecture

- **Recommendation Engine**: Rule-based matching against learner's lowest scoring skill with evidence. Suggests candidate materials with actions `REUSE` (exact level match), `ADAPT` (adjacent level), or `NO_MATCH` (routes to manual creation).
- **Grading Engine**: Automated grading for Multiple Choice Questions (MCQ) and teacher rubric evaluation for open-ended questions. Generates idempotent `QUESTION_RESULT` and `RUBRIC_RESULT` learning evidence.
- **Evidence-Grounded State**: Learner proficiency is calculated dynamically as a rolling weighted average (recent-N = 20) with strict `NO_DATA` confidence when 0 observations exist.
- **S3 Storage**: Connects to SeaweedFS using standard AWS SDK S3 client with automatic bucket provisioning and pre-signed URLs for file uploads and downloads.
