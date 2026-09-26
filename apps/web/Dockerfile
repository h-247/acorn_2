# The Next.js front end.
#
# Built from the repository root, same reason as the API:
#   docker build -f apps/web/Dockerfile -t acorn-web .

FROM node:20-alpine AS base
# Corepack reads the pinned version from package.json. Without the prompt
# disabled it asks before downloading, which a non-interactive build or a
# `compose exec` cannot answer.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build

# NEXT_PUBLIC_* is inlined into the browser bundle at build time, not read when
# the container starts. So this is the address the *browser* will use, which
# makes it the published port on the host - never the compose service name,
# which means nothing outside the compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @acorn/contracts build \
 && pnpm --filter @acorn/web build

FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app /app
WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "start"]
