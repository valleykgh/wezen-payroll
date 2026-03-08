FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps first (better caching)
COPY apps/api/package*.json /app/
RUN npm ci

# Copy API source into /app
COPY apps/api/ /app/

# Copy Prisma schema + migrations into /prisma
COPY prisma/schema.prisma /prisma/schema.prisma
COPY prisma/migrations /prisma/migrations

ENV NODE_ENV=development

# Build API
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "run", "start:prod"]
