FROM node:20-slim AS builder
WORKDIR /app

COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api ./
COPY prisma ./prisma

RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY apps/api/payroll-ukg-imports.sql /app/payroll-ukg-imports.sql
COPY apps/api/scripts ./scripts
COPY tools/payroll-toolkit/wezen-payroll-toolkit/templates/Wezen_Payroll_Toolkit_Starter.xlsm /app/assets/Wezen_Payroll_Toolkit_Starter.xlsm
COPY apps/staffing-web/public/icons/icon-512.png /app/assets/wezen-logo.png

CMD ["npm", "run", "start:prod"]
