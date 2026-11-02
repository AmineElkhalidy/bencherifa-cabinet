# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------
# Cabinet Bencherifa — production image
# Next.js 16 (App Router, output: "standalone") + Prisma + SQLite.
# Multi-stage build keeps the final image small (~180 MB).
# ----------------------------------------------------------------

ARG NODE_VERSION=20.18.0

# ----------------------------------------------------------------
# 1. deps — install all dependencies (cached separately from src)
# ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy manifests first to maximise Docker layer caching.
COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm ci --no-audit --no-fund

# ----------------------------------------------------------------
# 2. builder — generate Prisma client + build Next.js
# ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

ARG NEXT_PUBLIC_CLINIC_NAME
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_DOCTOR_NAME_FR
ARG NEXT_PUBLIC_DOCTOR_NAME_AR
ARG NEXT_PUBLIC_SPECIALTY_FR
ARG NEXT_PUBLIC_SPECIALTY_AR
ARG NEXT_PUBLIC_CREDENTIALS_FR
ARG NEXT_PUBLIC_CREDENTIALS_AR
ARG NEXT_PUBLIC_TITLE
ARG NEXT_PUBLIC_LOCATION
ARG NEXT_PUBLIC_PHONES
ARG NEXT_PUBLIC_ADDRESS_FR
ARG NEXT_PUBLIC_ADDRESS_AR

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy URL just for `prisma generate` and `next build`. The real
# DATABASE_URL is injected at runtime via docker-compose.
ENV DATABASE_URL="file:./build.db"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ----------------------------------------------------------------
# 2b. prisma-cli — isolated Prisma CLI tree for runtime migrations
# ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS prisma-cli
WORKDIR /prisma-cli
RUN npm init -y && npm install prisma@6.19.3 --no-audit --no-fund

# ----------------------------------------------------------------
# 3. runner — minimal runtime image
# ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root runtime user
RUN addgroup -g 1001 -S nodejs \
  && adduser  -u 1001 -S nextjs -G nodejs

# --- Next.js runtime artefacts ---
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# --- Prisma & seed runtime artefacts ---
COPY --from=builder --chown=nextjs:nodejs /app/prisma                      ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs       ./node_modules/bcryptjs

# Isolated Prisma CLI + all transitive deps for `prisma migrate deploy`
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli/node_modules ./prisma-cli/node_modules

# --- Persistent data dir (DB + uploaded medical documents + backups) ---
RUN mkdir -p /app/data /app/data/uploads /app/data/backups \
  && chmod 700 /app/data /app/data/uploads /app/data/backups \
  && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

# --- Entrypoint ---
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

# tini reaps zombies and forwards signals (graceful SIGTERM for Next.js)
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
