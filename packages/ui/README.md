# `packages/ui`

Acorn's reusable UI language is a code artifact, not a folder of ad-hoc page components.

```text
src/
├── primitives/   # Button, Input, Select, Badge, Dialog, Drawer, Table...
├── patterns/     # SearchFilterBar, MasterDetail, StatusHeader, EmptyState...
└── features/     # domain-aware compositions
```

Rules:

- `primitives` do not know Acorn domain semantics.
- `patterns` know interaction patterns but do not own business truth.
- `features` map domain semantics to primitives/patterns.
- Default teacher UI is **medium density, visually relaxed**.
- Never shrink typography to keep more rows/cards above the fold.
