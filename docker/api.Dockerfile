FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy API into /app
COPY apps/api/ /app/

# Copy Prisma schema into /prisma (needed for migrate at runtime)
COPY prisma/ /prisma/

ENV NODE_ENV=development
RUN npm install

# Build API
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "run", "start:prod"]
