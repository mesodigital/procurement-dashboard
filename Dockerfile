FROM node:22-alpine AS build
WORKDIR /repo/app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /repo/app
ENV NODE_ENV=production PORT=5177
COPY app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /repo/app/dist ./dist
COPY app/server ./server
COPY data /repo/data
EXPOSE 5177
CMD ["node", "server/index.js"]
