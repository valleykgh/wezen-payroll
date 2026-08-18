FROM node:20-alpine AS deps
WORKDIR /app

COPY apps/staffing-api/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

COPY apps/staffing-api/prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
COPY apps/staffing-api ./

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/ukg-migration.sql ./ukg-migration.sql
EXPOSE 4001

CMD ["sh", "-c", "npm run migrate:deploy && node dist/index.js"]
