# On-prem profile

Target initial topology:

```text
Reverse proxy
├── Web
└── API
    ├── PostgreSQL
    └── MinIO
```

Docker Compose is sufficient for the MVP/pilot. Kubernetes is not required.
