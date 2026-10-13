# Built from the repository root, as Lightscapes shares some of Clockmaker's source:
#   docker build -f lightscapes/Dockerfile .
FROM node:22-alpine AS build

WORKDIR /repo
COPY src/lib ./src/lib
COPY lightscapes/package*.json ./lightscapes/
RUN cd lightscapes && npm ci
COPY lightscapes ./lightscapes
RUN cd lightscapes && npm run build && npm prune --omit=dev

FROM node:22-alpine AS production

# Where the configuration is kept; mount a volume at /data to keep it
ENV LIGHTSCAPES_DATA_DIR=/data
ENV PORT=8090

WORKDIR /app
COPY --from=build /repo/lightscapes/dist ./dist
COPY --from=build /repo/lightscapes/public ./public
COPY --from=build /repo/lightscapes/node_modules ./node_modules
COPY --from=build /repo/lightscapes/package.json ./
EXPOSE 8090
ENTRYPOINT ["node", "dist/main.js"]
