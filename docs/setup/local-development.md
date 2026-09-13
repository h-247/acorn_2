# Local development

## Goal

Every developer must be able to work on Acorn without a Cloudflare account.

## Infrastructure

```bash
cp .env.example .env
make infra-up
```

This starts:

- PostgreSQL on `localhost:5432`
- MinIO S3 endpoint on `localhost:9000`
- MinIO console on `localhost:9001`

The web/API processes are intentionally not scaffolded in this archive because the backend framework has not been frozen and the Next.js app should be initialized deliberately rather than from accidental generated defaults.

## Cloud equivalence

Local MinIO exercises the same S3-compatible application boundary that cloud pilot uses with R2.
