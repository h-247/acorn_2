# ADR-0002 — PostgreSQL is the Canonical Database

**Status:** Accepted

Use PostgreSQL for local, cloud-pilot and on-prem profiles. D1 may be experimented with separately but is not the authoritative Acorn database.

This avoids a PoC→production data-layer migration and preserves migrations, transactions, query semantics, indexes and backup procedures.
