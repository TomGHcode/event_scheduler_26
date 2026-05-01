# 1. posms: Būvēšana
FROM node:20-alpine AS builder

WORKDIR /app

# Kopējam pakotņu failus, lai izmantotu kešatmiņu
COPY package*.json ./
RUN npm install

# Kopējam pārējo kodu un būvējam TypeScript
COPY . .
RUN npm run build

# 2. posms: Izpilde (Production)
FROM node:20-alpine

WORKDIR /app

# Kopējam tikai nepieciešamos failus no builder posma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Fastify noklusējuma ports
EXPOSE 3000

CMD ["node", "dist/index.js"]