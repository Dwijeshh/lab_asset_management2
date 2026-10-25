# Build the Next.js standalone server with a supported Node runtime.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Copy repository scripts before npm ci so package lifecycle hooks can access them.
COPY . .
RUN npm ci
# Next.js imports server modules during compilation. These values are only
# placeholders for the builder stage; runtime values come from Azure secrets.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    JWT_SECRET=build-only-secret-0123456789abcdefghijklmnop \
    npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
