# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/kanboard/kanboard" \
    org.opencontainers.image.title="Kanboard" \
    org.opencontainers.image.description="Kanboard is project management software that focuses on the Kanban methodology" \
    org.opencontainers.image.vendor="Kanboard" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://kanboard.org" \
    org.opencontainers.image.documentation="https://docs.kanboard.org"

ARG VERSION=main.unknown_revision
ENV NODE_ENV=production \
    APP_VERSION=$VERSION \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
RUN apk add --no-cache tzdata curl
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p data plugins && chown -R node:node /app/data /app/plugins

USER node
VOLUME ["/app/data", "/app/plugins"]
EXPOSE 8080

HEALTHCHECK --start-period=5s --timeout=5s \
  CMD curl -f http://localhost:8080/healthcheck || exit 1

CMD ["node", "dist/server.js"]
