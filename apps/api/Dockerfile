FROM node:20-bullseye-slim

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma
COPY apps/api ./apps/api

RUN npm install

WORKDIR /app/apps/api
RUN npm run prisma:generate
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]
