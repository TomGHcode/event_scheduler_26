# 1. posms: Būvēšana
FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. posms: Servēšana ar Nginx
FROM nginx:stable-alpine

# Kopējam Nginx konfigurācijas failu, lai strādātu Vue Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopējam uzbūvētos statiskos failus uz Nginx direktoriju
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]