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
COPY tools/payroll-toolkit/wezen-payroll-toolkit/templates/Wezen_Payroll_Toolkit_Starter.xlsm ./apps/api/assets/Wezen_Payroll_Toolkit_Starter.xlsm
COPY apps/staffing-web/public/icons/icon-512.png ./apps/api/assets/wezen-logo.png

# Build
WORKDIR /app/apps/api
RUN npm run prisma:generate
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
