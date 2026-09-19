# ADR-0007 — Backend Framework Selection: Fastify + TypeScript + Drizzle ORM

**Status:** Accepted

## Context

`docs/setup/backend-framework-selection.md` leaves the concrete backend framework as an open technical choice that must satisfy:
- modular-monolith organization;
- PostgreSQL with migrations;
- REST APIs;
- server-side authorization;
- container deployment;
- environment-based configuration;
- reliable validation and testing;
- background/retry work where needed;
- clean adapters for S3-compatible storage and AI providers.

## Decision

We select **Fastify** with **TypeScript**, **Drizzle ORM** (targeting PostgreSQL with schema migrations via `drizzle-kit`), and **Zod** for schema validation.

## Rationale

1. **Modular Monolith Encapsulation**: Fastify's plugin architecture natively supports bounded module encapsulation. Each domain module (`identity`, `course`, `material`, `taxonomy`, `assessment`, `submission`, `evidence`, `learner-state`, `recommendation`, `ai`, `audit`) is encapsulated in its own plugin with private services and scoped routes.
2. **First-Class TypeScript & Contract Sharing**: Fastify integrates with `@acorn/contracts` Zod schemas for runtime request/response validation and TypeScript type inference.
3. **In-Process Testing Speed**: Fastify's `inject()` enables full end-to-end HTTP request testing in memory without allocating network sockets, accelerating unit and integration test execution.
4. **Drizzle ORM for PostgreSQL**: Lightweight, SQL-native, zero-native-engine binary dependencies, with type safety, migration support, and native transaction control.
5. **Clean Adapter Boundaries**: Dependency injection for S3/MinIO storage and AI providers is cleanly attached to Fastify instance decorators (`fastify.storage`, `fastify.ai`).

## Consequences

- No external RPC/microservices dependencies needed for MVP.
- All 11 domain modules live inside `apps/api/src/modules/` and communicate through application contracts.
