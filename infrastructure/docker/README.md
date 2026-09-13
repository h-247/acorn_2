# Docker infrastructure

`compose.dev.yml` currently bootstraps only the infrastructure whose technology has been frozen: PostgreSQL + MinIO.

Add web/API containers after their actual build/runtime contracts exist. Avoid placeholder Dockerfiles that encode an unreviewed framework decision.
