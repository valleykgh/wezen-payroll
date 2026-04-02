FROM node:18-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api ./
COPY prisma /prisma

RUN npx prisma generate --schema=/prisma/schema.prisma
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start:prod"]
