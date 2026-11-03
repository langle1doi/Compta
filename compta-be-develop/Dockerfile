# syntax=docker/dockerfile:1

# Debian (glibc) image: argon2 and Prisma ship prebuilt binaries for it
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# All dependencies, for building. Our own lifecycle scripts (husky, prisma generate) are
# removed here; dependency install scripts (argon2, Prisma engines) still run.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare scripts.postinstall && npm ci

# ---------------------------------------------------------------------------
FROM deps AS build
# prisma.config.ts requires these to be set; nothing connects during the build
ENV CONTROL_DATABASE_URL=postgresql://build@localhost/build \
    TENANT_DATABASE_URL=postgresql://build@localhost/build
COPY . .
RUN npx prisma generate --config prisma.control.config.ts \
 && npx prisma generate --config prisma.tenant.config.ts \
 && npx nest build

# ---------------------------------------------------------------------------
# Production dependencies only. The Prisma CLI stays: the API runs `migrate deploy` when provisioning a tenant.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare scripts.postinstall && npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
FROM base AS runtime
# npm is not used at runtime, and its bundled packages fail the image scan
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
ENV NODE_ENV=production \
    PORT=3000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.control.config.ts prisma.tenant.config.ts ./
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Node receives SIGTERM directly (no shell): Nest shutdown hooks close pools and the HTTP server
CMD ["node", "dist/main.js"]
