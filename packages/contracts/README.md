# `packages/contracts`

Shared cross-boundary contracts only. Do not place backend domain entities here merely to avoid duplication.

Likely contents after implementation starts:

- API request/response schemas
- explicit enums intended for client/server exchange
- validation schemas generated/shared intentionally

Provider-specific AI objects and database ORM models must not leak here.
