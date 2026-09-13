# Backend framework selection — open decision

The **architecture is frozen; the concrete backend framework is not**.

The selected framework must support:

- modular-monolith organization;
- PostgreSQL with migrations;
- REST APIs;
- server-side authorization;
- container deployment;
- environment-based configuration;
- reliable validation and testing;
- background/retry work where needed;
- clean adapters for S3-compatible storage and AI providers.

Do not choose a framework merely because a code generator initialized it first. Record the final choice as an ADR.
