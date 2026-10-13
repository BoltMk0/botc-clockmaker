FROM node:22-alpine AS build


WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

FROM node:20-alpine AS production

# Where configuration, resources and feedback are stored; mount a volume at /data to keep them
ENV RESOURCE_DATA_DIR=/data
ENV FEEDBACK_DATA_DIR=/data/feedback
# Measures the music tracks' loudness, for loudness levelling
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
# Music tracks (lossless ones especially) are uploaded one file per request
ENV BODY_SIZE_LIMIT=200M
EXPOSE 3000
ENTRYPOINT ["node", "build"]
