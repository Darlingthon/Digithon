# Build from the REPO ROOT:  docker build -f apps/web/Dockerfile -t trustline-web .
# Next.js standalone output in an npm-workspaces monorepo.
# syntax=docker/dockerfile:1
FROM node:22-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ── deps: install workspace deps from lockfile ──
FROM base AS deps
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/channels/package.json apps/channels/
RUN npm ci

# ── builder: prisma generate + next build ──
FROM base AS builder
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build --workspace @trustline/web

# ── runner: minimal standalone server ──
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# standalone keeps the monorepo layout under .next/standalone
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
