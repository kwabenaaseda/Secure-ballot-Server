# Builder stage
FROM oven/bun:latest AS builder

WORKDIR /app

COPY package*.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to dist/
RUN bun run build

# Production image
FROM oven/bun:latest

WORKDIR /app

RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

# ── Self-contained PWA ───────────────────────────────────────────────────────
# Vendor the built client (React SPA) so the server serves UI + API + docs from
# ONE origin — installable/downloadable as a PWA. Drop the client build into
# client-dist/ before building:  cp -r ../Secure-ballot-Client/dist ./client-dist/
# Build arg override:  --build-arg CLIENT_DIST_PATH=path/to/dist
ARG CLIENT_DIST_PATH=./client-dist
COPY ${CLIENT_DIST_PATH} ./client-dist

RUN mkdir -p logs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "dist/server.js"]