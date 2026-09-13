# Cloud pilot profile

Target topology:

```text
Cloudflare DNS/CDN
├── Next.js web delivery
└── container-hosted API
      ├── managed PostgreSQL
      └── Cloudflare R2
```

Cloudflare is an optimization. The core API must not require Cloudflare runtime bindings.
