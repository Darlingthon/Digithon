# Build from the REPO ROOT:  docker build -f apps/channels/Dockerfile -t trustline-channels .
# Runs the TS service directly via tsx (no compile step).
# Multi-stage: the runtime image installs ONLY the channels subtree (prod deps),
# so the monorepo's web deps (Next.js/React, ~416MB) never land in the image.
# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Shared manifest layer (best cache reuse).
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/channels/package.json apps/channels/

# builder: full install + prisma generate (needs the prisma CLI, a dev dep).
FROM manifests AS builder
RUN npm ci
COPY packages/db/prisma packages/db/prisma
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# proddeps: only the channels workspace + root, production deps only.
# Prune build-only tooling in the SAME layer (otherwise a later rm doesn't
# shrink the image — the files persist in the lower layer).
FROM manifests AS proddeps
RUN npm ci --omit=dev --workspace=@trustline/channels --include-workspace-root \
 && rm -rf node_modules/prisma node_modules/typescript \
      node_modules/.bin/prisma node_modules/.bin/prisma2 \
      node_modules/.bin/tsc node_modules/.bin/tsserver

# runner: slim prod node_modules + the generated prisma client from builder.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY . .
# Cloud Run injects PORT (8080); config.ts reads PORT first.
EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "@trustline/channels"]
