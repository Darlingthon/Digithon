# Build from the REPO ROOT:  docker build -f apps/channels/Dockerfile -t trustline-channels .
# Runs the TS service directly via tsx (no compile step).
# syntax=docker/dockerfile:1
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/channels/package.json apps/channels/
RUN npm ci

COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

ENV NODE_ENV=production
# Cloud Run injects PORT (8080); config.ts reads PORT first.
EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "@trustline/channels"]
