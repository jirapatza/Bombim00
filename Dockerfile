# Dockerfile for Lottery Alert System & Web Dashboard
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Runner
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install Python3 for lottery checker script
RUN apk add --no-cache python3 py3-pip curl

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/config ./config
COPY --from=build /app/status ./status
COPY --from=build /app/lottery_previous_results.json ./lottery_previous_results.json
COPY --from=build /app/settings_loader.py ./settings_loader.py
COPY --from=build /app/lottery_checker.py ./lottery_checker.py

RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
