FROM node:20-bullseye-slim

WORKDIR /app

# Copy only the API package files first
COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma

# Install API dependencies only
WORKDIR /app/apps/api
RUN npm install

# Copy source after install for better layer caching
WORKDIR /app
COPY apps/api ./apps/api

# Build
WORKDIR /app/apps/api
RUN npm run prisma:generate
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
