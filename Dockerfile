# Ampcurve production image.
#
# Single stage: better-sqlite3 ships a native binding, so the image that
# installs it is the image that runs it — a separate build stage buys
# nothing here and risks a glibc/arch mismatch.

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# better-sqlite3 ships prebuilt binaries for common platforms, but falls back
# to compiling its native binding from source (node-gyp) whenever no
# prebuild matches the build host's OS/arch/Node ABI — e.g. on several
# hosted CI/build platforms. node:22-slim doesn't include that toolchain by
# default, so install it before `npm ci`; the compiled output is a static
# .node file that needs no toolchain to run afterward. Left installed
# (rather than purged in a later layer) since removing it wouldn't actually
# shrink a non-squashed single-stage image anyway.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Data dir holds the SQLite file. No `VOLUME` instruction here — that's
# left to the host platform's own volume mechanism (e.g. Railway Volumes,
# or the named volume in docker-compose.yml), since some platforms reject
# a Dockerfile-level VOLUME outright. Just make sure the directory exists
# and is writable by the user the app runs as; whatever gets mounted over
# it in production inherits that.
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
