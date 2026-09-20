# ADR-0003 — S3-Compatible Object Storage

**Status:** Accepted

Material files, audio, thumbnails and generated artifacts live behind an `ObjectStorage` application boundary.

- local/on-prem default: SeaweedFS (S3-compatible, Apache-2.0);
- cloud/production: Cloudflare R2 or AWS S3;
- alternate/legacy: MinIO.

PostgreSQL stores metadata/object keys, not large binary assets.
