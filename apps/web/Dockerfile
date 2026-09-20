# The frontend: a static bundle built from the repository, served by nginx.
#
# The build context is the repository root, not apps/web: the site compiles the
# hand-maintained half of the data into itself (registry/, the feed.json and
# metric.json next to each adapter). No network is needed at build time.
#
# The image contains no configuration. Where the generated data is read from is
# decided by config.json, mounted at run time:
#
#   docker build -f apps/web/Dockerfile -t defi-dna-web .
#   docker run -p 8080:80 -v ./configs/config.json:/usr/share/nginx/html/config.json:ro defi-dna-web

# Debian rather than alpine for the build: rollup and esbuild ship prebuilt
# binaries per libc, and glibc is the variant every lockfile is sure to carry.
FROM node:24-slim AS build
WORKDIR /app

# Dependencies first: they change far less often than the code.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/data-client/package.json packages/data-client/
COPY apps/pipeline/package.json apps/pipeline/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .

# "/" for a domain root, "/defi-dna/" for a project path, "./" for IPFS.
ARG DEFI_DNA_BASE=/
ENV DEFI_DNA_BASE=$DEFI_DNA_BASE
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf

# The image is the app and nothing else: the data comes from the data
# repository and config.json is mounted, so neither is baked in here.
RUN rm -rf /usr/share/nginx/html/data /usr/share/nginx/html/config.json

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO /dev/null http://localhost/index.html || exit 1
