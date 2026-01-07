FROM node:20-alpine AS build


WORKDIR /app

COPY package*.json ./
COPY src ./src
COPY static ./static
COPY svelte.config.js vite.config.ts tsconfig.json .npmrc ./

RUN npm install
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
EXPOSE 3000
ENTRYPOINT ["node", "build"]
