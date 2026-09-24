# Acorn Local Runnable Version Guide

This guide explains how each collaborator can run an independent local copy of Acorn for development and review. Each laptop has its own PostgreSQL database and SeaweedFS storage; application data is not synchronized through Git.

## What This Version Contains

- Local web app and API runnable on one machine.
- Three supported user roles: `Admin`, `Teacher`, and `Student`.
- One sample course: `IELTS 5.0 Preparation`.
- One sample class: `IELTS 5.0 Foundation A`.
- One teacher assigned to the class.
- Ten students enrolled in the class.
- Local PostgreSQL database and local S3-compatible object storage.

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- Docker Desktop running locally

## First-Time Setup (Windows PowerShell)

Clone the repository and switch to the branch containing this local demo (GitHub repository access is required):

```powershell
git clone https://github.com/AgentiviumAI/acorn.git
cd acorn
git switch runnable-local-version
```

Install dependencies:

```powershell
pnpm install
```

Create a separate local environment file on each laptop (do not share or commit a real `.env`):

```powershell
Copy-Item .env.example .env
```

Start the local infrastructure:

```powershell
docker compose -f compose.dev.yml up -d
```

Expected local services:

- PostgreSQL: `localhost:5435`
- SeaweedFS S3 API: `localhost:8333`
- SeaweedFS master: `localhost:9333`

## Database Initialization And Seed (First Run Only)

First, apply database migrations to create the tables on a new laptop:

```powershell
pnpm --filter @acorn/api db:migrate
```

Then reset the **local development database** and recreate the sample data:

```powershell
pnpm db:reset
```

**Warning:** `pnpm db:reset` deletes existing application data before reseeding. Run it for first-time demo initialization or only when you intentionally want to discard local changes. It is not required every time the app starts.

The reset command is restricted to this local development database:

```text
postgresql://acorn:acorn_dev_only@localhost:5435/acorn
```

After reset, the sample data should contain:

- 1 admin
- 1 teacher
- 10 students
- 1 course
- 1 class
- 10 enrollments

## Run The App

After first-time setup, start the local containers (if they are stopped) and both applications:

```powershell
docker compose -f compose.dev.yml up -d
pnpm dev
```

Do not run `pnpm db:reset` on normal starts.

To start only the API and web app when containers are already running, use:

```powershell
pnpm dev
```

Or start them separately:

```powershell
pnpm dev:api
pnpm dev:web
```

Open the app:

```text
http://localhost:3000
```

The API runs at:

```text
http://localhost:4000
```

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@acorn.edu` | `admin123` |
| Teacher | `taylor@acorn.edu` | `password123` |
| Student | `emma.nguyen@student.acorn.edu` | `password123` |
| Student | `liam.chen@student.acorn.edu` | `password123` |

The database contains eight additional student accounts in the same class.

## Main Local Review Flow

1. Sign in as Admin and review admin management pages.
2. Sign in as Teacher and review class, learner, material, assessment, submission, evidence, and recommendation flows.
3. Sign in as Student and review assigned assessments, materials, and progress.
4. Confirm the sample data shows one IELTS 5.0 course with one teacher and ten students.

## Verification Commands

Run these verification commands after the database has been initialized (they do not require a database reset):

```powershell
pnpm test
pnpm --filter @acorn/web lint
pnpm build
```

For browser-based end-to-end tests, install Playwright Chromium once, then run:

```powershell
pnpm --filter @acorn/web exec playwright install chromium
pnpm --filter @acorn/web test:e2e
```

Review any failures instead of resetting the database as a default troubleshooting step.

## Notes For Sharing

If sending the repository as a zip file, do not include generated or dependency folders such as:

- `node_modules`
- `.next`
- `dist`
- coverage folders
- log files

If sharing through Git, grant your teammate repository access and ask them to check out `runnable-local-version`. Commit and push code changes normally; `.env` stays on each laptop. Each collaborator's database and uploaded files remain local to that laptop.
