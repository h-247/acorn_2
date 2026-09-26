# The modular monolith, in one container.
#
# All eleven modules - identity, taxonomy, course, material, assessment,
# submission, evidence, learner-state, recommendation, ai, audit - are folders
# inside this single process, not separate services. That is ADR-0001, and it is
# why there is one image here rather than eleven.
#
# Built from the repository root, because a pnpm workspace package cannot be
# built without the workspace around it:
#   docker build -f apps/api/Dockerfile -t acorn-api .

FROM node:20-alpine AS base
# Corepack reads the pinned version from package.json. Without the prompt
# disabled it asks before downloading, which a non-interactive build or a
# `compose exec` cannot answer.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ── dependencies ────────────────────────────────────────────────────────────
#
# Manifests first, source later. Dependencies only change when a package.json or
# the lockfile does, so editing application code reuses this layer instead of
# reinstalling the whole workspace - which on a slow connection is the
# difference between seconds and a quarter of an hour.
#
# Every workspace member's package.json has to be present even though this image
# only runs the API: pnpm resolves the workspace as a whole and fails on a
# member it cannot find.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────────
#
# contracts before api, and not only for ordering: it publishes real JavaScript
# that the API imports at runtime. Pointing its `main` at a .ts file is what
# used to make `node dist/index.js` fail on its first import.
FROM deps AS build
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @acorn/contracts build \
 && pnpm --filter @acorn/api build

# ── runtime ─────────────────────────────────────────────────────────────────
#
# Dev dependencies are kept on purpose. drizzle-kit runs the migrations and tsx
# runs the seed, so an image without them could serve requests but could not
# prepare the database it serves from - and for a local demo that trade is worth
# more than a smaller image.
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000

COPY --from=build /app /app
WORKDIR /app/apps/api

EXPOSE 4000

# No shell, so signals reach Node and the container stops when asked to.
CMD ["node", "dist/index.js"]
