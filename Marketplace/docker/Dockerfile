FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY docker/server.js ./docker/server.js
COPY --from=build /app/dist/marketplace-shell/browser ./dist/marketplace-shell/browser
EXPOSE 8080
CMD ["node", "docker/server.js"]
