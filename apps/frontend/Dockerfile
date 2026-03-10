FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm install

COPY . .

WORKDIR /app/apps/frontend

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
