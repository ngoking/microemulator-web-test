FROM eclipse-temurin:17-jdk-jammy AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY . .
RUN python3 build.py
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs ./
COPY --from=build /build/web ./web
ENV NODE_ENV=production PORT=10000
USER node
EXPOSE 10000
CMD ["node","server.mjs"]
