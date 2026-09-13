# ADR-0003 — S3-Compatible Object Storage

**Status:** Accepted

Material files, audio, thumbnails and generated artifacts live behind an `ObjectStorage` application boundary.

- cloud: Cloudflare R2;
- local/on-prem: MinIO;
- future: another S3-compatible provider.

PostgreSQL stores metadata/object keys, not large binary assets.
