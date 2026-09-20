# Acorn by Agentivium AI

> **Working tagline:** Every class makes your teaching smarter.

Acorn is an evidence-grounded learning-material platform for English centers. It helps teaching teams organize, reuse, adapt, deliver, observe, and continuously improve learning materials using structured learner evidence while keeping teachers in the decision loop.

## North Star

Turn commonly available teaching materials into a center-specific knowledge asset that improves through learner evidence and teacher decisions.

```text
Material
→ Assessment
→ Learner Activity
→ Learning Evidence
→ Learner State
→ Recommendation
→ Teacher Decision
→ Reuse / Adapt
→ Next Learning Activity
```

## Non-AI Local Profile Architecture

Acorn runs 100% locally with zero paid cloud services or artificial AI mockups:

- **Frontend:** Next.js 14 App Router + Tailwind CSS (`apps/web`) across 19 non-AI screens
- **Backend:** Fastify modular monolith (`apps/api`) with Zod contract validation and scoped RBAC
- **Database:** PostgreSQL 16 (`acorn-postgres` container on port 5435) with Drizzle ORM
- **Object Storage:** SeaweedFS S3-compatible storage (`acorn-seaweedfs` container on port 8333)
- **Authentication:** Password hashing via `scrypt`, signed JWT tokens, and strict role scoping (`TEACHER`, `STUDENT`, `ADMIN`, `ACADEMIC_MANAGER`)
- **Recommendation Engine:** Deterministic rule engine grounded in learner evidence (`REUSE`, `ADAPT`, `NO_MATCH`)
- **Grading & Evidence:** Answer-key MCQ auto-grading and teacher rubric evaluation generating idempotent learning evidence

## Repository Map

```text
acorn/
├── apps/
│   ├── web/                    # Next.js 14 frontend (19 non-AI screens)
│   └── api/                    # Fastify modular monolith backend
├── packages/
│   ├── ui/                     # Acorn UI design system & components
│   ├── contracts/              # Shared Zod DTO contracts & enums
│   └── config/                 # Tooling configuration (ESLint, TS)
├── infrastructure/
│   ├── docker/                 # SeaweedFS S3 config & scripts
│   └── deployments/
├── docs/
│   ├── canonical/              # Versioned product and technical specification
│   ├── adr/                    # Architecture Decision Records
│   ├── ui/                     # Screen inventory (19 non-AI screens)
│   ├── setup/                  # Local development & setup guides
│   └── evaluation/
└── compose.dev.yml             # PostgreSQL (5435) + SeaweedFS (8333/9333) local infra
```

## Quick Start (Local Development)

### 1. Start Local Infrastructure

```powershell
# Copy environment file
Copy-Item .env.example .env

# Start PostgreSQL and SeaweedFS containers
docker compose -f compose.dev.yml up -d
```

### 2. Install & Seed Database

```powershell
# Install workspace dependencies
pnpm install

# Apply database migrations and seed sample data
pnpm --filter @acorn/api db:migrate
pnpm --filter @acorn/api db:seed
```

### 3. Run Applications

```powershell
# Start API (http://localhost:4000)
pnpm --filter @acorn/api dev

# Start Web (http://localhost:3000)
pnpm --filter @acorn/web dev
```

### 4. Run Verification Suite

```powershell
# Run all tests (unit + integration)
pnpm test

# Build all packages
pnpm build

# Lint frontend web application
pnpm --filter @acorn/web lint
```

## Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Teacher** | `taylor@acorn.edu` | `password123` |
| **Student** | `emma.nguyen@student.acorn.edu` (or `emma@acorn.edu`) | `password123` |
| **Admin** | `admin@acorn.edu` | `admin123` |

## Core Invariants

- Learning evidence is structured, traceable, and idempotent.
- Learner state is derived and recomputable from retained evidence (`recent-N = 20`).
- Content strategy is **Reuse → Adapt → Author New Material** (`NO_MATCH`).
- Teacher-in-the-loop is mandatory for recommendation decisions.
- Material provenance survives reuse and adaptation.
- `NO_DATA` is not low performance.
- UI is **information-rich, visually relaxed**.

## Canonical Documentation

- Local Setup Guide: [`docs/setup/local-development.md`](docs/setup/local-development.md)
- Screen Inventory: [`docs/ui/screen-inventory.md`](docs/ui/screen-inventory.md)
- Canonical Specifications: [`docs/canonical/`](docs/canonical/)
- Architecture Decision Records: [`docs/adr/`](docs/adr/)
