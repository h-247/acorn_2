# 13 — Deployment, Cloud & Portability

## For a new developer

Local development must work without a Cloudflare account. The portable core is a containerized API, PostgreSQL, S3-compatible object storage and a provider-independent AI adapter. Cloudflare/R2 and MinIO are infrastructure choices behind those boundaries.

When adding an integration, decide whether it is domain logic or an adapter, verify a local equivalent, keep secrets in configuration, and document retry/backup/failure behavior. Do not import Cloudflare runtime APIs into domain/application code.

> **Cloudflare Free Tier is a deployment optimization, not the architecture. PostgreSQL + S3-compatible storage + containerized API are the portable architecture.**

## Frozen baseline

```text
Web            Next.js
API            modular monolith · containerized
Database       PostgreSQL
Object storage S3-compatible
Cloud storage  Cloudflare R2
On-prem store  MinIO
AI             provider-independent adapter
Deployment     Local / Cloud Pilot / On-prem
```

## Database

PostgreSQL is canonical from the first implementation through pilot and on-prem. D1 is not the primary Acorn database; choosing it for PoC would create unnecessary migration/revalidation of SQL, ORM, transactions, indexes and backups later.

One PostgreSQL database is sufficient for MVP. Logical module ownership does not require database-per-module.

## Storage

Binary learning assets live in S3-compatible object storage behind an application `ObjectStorage` boundary.

```text
Application → ObjectStorage → R2 / MinIO / future S3
```

## Cloudflare boundary

Appropriate: DNS, CDN/static delivery, frontend delivery where suitable, R2 and future edge security/routing.<br>
Not core assumptions: D1 as authoritative DB, Cloudflare runtime bindings in domain/application services, Workers as a requirement for core API, Cloudflare Access as Acorn's role source of truth.

## Deployment profiles

### Local

```text
Web + API + PostgreSQL + MinIO
```

A developer must not need a Cloudflare account.

### Cloud pilot

```text
Cloudflare DNS/CDN
├── web delivery
└── container API
    ├── managed PostgreSQL
    └── R2
```

### On-prem

```text
Reverse proxy
├── Web
└── API
    ├── PostgreSQL
    └── MinIO
```

Docker Compose is enough initially. Kubernetes is an explicit non-goal for MVP.

## Free-tier policy

Free tiers are acceptable for thesis development, demo and small pilot. Do **not** promise a production SLA or “free forever” based on staying under quotas. Real deployments must plan for backup, monitoring, capacity and paid upgrades when needed.

## Portability acceptance

- local runs without Cloudflare credentials;
- same PostgreSQL migrations across profiles;
- R2 ↔ MinIO is adapter/config change, not domain rewrite;
- AI provider is replaceable behind adapter;
- core API is a standard container;
- backup/restore is defined before real learner pilot data.
