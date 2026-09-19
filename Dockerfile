# Cloud Run image. Slim base, no build step beyond inlining the engine.
FROM node:20-slim

WORKDIR /app

# Only the manifest first, so the dependency layer caches.
COPY package.json ./
# No runtime dependencies — jsdom is dev-only, used by the DOM tests.
RUN npm install --omit=dev --no-audit --no-fund || true

COPY . .

# Rebuild index.html inside the image so the deployed page can never
# be stale relative to engine.js.
RUN node build.js

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
