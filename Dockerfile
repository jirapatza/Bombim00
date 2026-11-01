# Production web/API service. Lottery checks run only in GitHub Actions.
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000
CMD ["node", "server.js"]
