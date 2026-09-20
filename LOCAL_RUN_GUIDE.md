# Acorn Local Runnable Version Guide

This guide explains how to run the local runnable version of Acorn for review.

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

## Setup

Install dependencies:

```powershell
pnpm install
```

Create the local environment file if it does not exist:

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

## Database Reset And Seed

Use this command to reset the local database and recreate the sample data:

```powershell
pnpm db:reset
```

The reset command is intended for the local development database:

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

If migrations need to be applied manually, run:

```powershell
pnpm --filter @acorn/api db:migrate
```

## Run The App

Start both API and web app:

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

The final local verification commands are:

```powershell
pnpm db:reset
pnpm test
pnpm --filter @acorn/web lint
pnpm build
pnpm --filter @acorn/web test:e2e
```

Expected result: all commands pass.

## Notes For Sharing

If sending the repository as a zip file, do not include generated or dependency folders such as:

- `node_modules`
- `.next`
- `dist`
- coverage folders
- log files

If sharing through Git, commit the code and this guide, then push the branch or repository.
