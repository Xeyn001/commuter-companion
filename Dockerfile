# Cloud Run image. Slim base, no build step beyond inlining the engine.
FROM node:20-slim

WORKDIR /app

# There are no runtime dependencies at all: jsdom is dev-only and the
# app uses nothing else. So there is no install step to fail, no
# lockfile to drift, and no registry to be unreachable at build time.
COPY . .

# Rebuild index.html inside the image so the deployed page can never
# be stale relative to engine.js.
RUN node build.js

# Fail the build rather than ship an image whose data files are missing:
# without bus-index.json every bus leg silently falls back to a modelled
# corridor, which is exactly the bug this is meant to prevent.
RUN test -s index.html && test -s data/bus-index.json && test -s data/events.json

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
