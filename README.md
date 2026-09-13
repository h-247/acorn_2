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
→ Reuse / Adapt / Generate
→ Next Learning Activity
```

## MVP architecture

- **Frontend:** Next.js + TypeScript
- **Backend:** modular monolith; framework intentionally not frozen in this bootstrap
- **Database:** PostgreSQL
- **Object storage:** S3-compatible (`R2` cloud, `MinIO` on-prem/local)
- **AI:** provider-independent adapter
- **Deployment:** local → low-cost cloud pilot → on-prem without domain rewrite
- **Repository:** monorepo

Cloudflare is a **deployment optimization, not the architecture**. D1 is not the canonical Acorn database.

## Repository map

```text
acorn/
├── apps/
│   ├── web/                    # Next.js application
│   └── api/                    # modular-monolith backend
├── packages/
│   ├── ui/                     # Acorn UI system
│   ├── contracts/              # cross-boundary DTO/schema contracts
│   └── config/                 # shared tooling config
├── infrastructure/
│   ├── docker/
│   └── deployments/
├── docs/
│   ├── canonical/              # versioned product and technical specification
│   ├── adr/                    # frozen decisions
│   ├── ui/                     # screen inventory + 20 mockups
│   ├── setup/
│   └── evaluation/
└── compose.dev.yml             # PostgreSQL + MinIO local infra
```

## Start here

1. Read [`docs/canonical/00-overview.md`](docs/canonical/00-overview.md).
2. Read [`docs/adr/README.md`](docs/adr/README.md) before changing architectural decisions.
3. Review [`docs/ui/screen-inventory.md`](docs/ui/screen-inventory.md) and [`docs/ui/mockups/README.md`](docs/ui/mockups/README.md) before UI implementation.
4. Copy `.env.example` to `.env`, then run `make infra-up`.
5. Choose and document the backend framework before bootstrapping `apps/api`.

## Core invariants

- Learning evidence is structured and traceable.
- Learner state is derived and recomputable from retained evidence.
- AI output is never academic truth by itself.
- Teacher-in-the-loop is mandatory for recommendation/content approval.
- Material provenance must survive reuse/adaptation.
- Content strategy is **Reuse → Adapt → Generate**.
- `NO_DATA` is not low performance.
- UI is **information-rich, visually relaxed**; never shrink typography to increase density.

## Canonical documentation

The versioned Markdown under `docs/canonical/` is the canonical product and technical specification for this repository. Architectural decisions are recorded in `docs/adr/`; update both when a frozen design decision changes.
