# Ampcurve production image.
#
# Single stage: better-sqlite3 ships a native binding, so the image that
# installs it is the image that runs it — a separate build stage buys
# nothing here and risks a glibc/arch mismatch.

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Data dir holds the SQLite file — mount it as a volume in production so
# signups survive container restarts/redeploys.
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
