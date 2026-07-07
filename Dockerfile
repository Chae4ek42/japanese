# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
COPY shared ./shared

RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY shared ./shared
COPY src/data ./src/data
COPY src/lib/romaji.js ./src/lib/romaji.js
COPY src/lib/trainer.js ./src/lib/trainer.js

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/server
CMD ["node", "src/index.js"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
