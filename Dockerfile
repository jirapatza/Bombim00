# Dockerfile for Lottery Alert System & Web Dashboard
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

RUN mkdir -p config status data
COPY . .
RUN npm run build

# Production Runner
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install Python3 for lottery checker script
RUN apk add --no-cache python3 py3-pip curl

COPY package*.json ./
RUN npm install --omit=dev

# Python runtime dependencies for checking lottery sources
COPY requirements.txt ./requirements.txt
RUN python3 -m pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/config /app/status /app/data

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/config ./config
COPY --from=build /app/status ./status
COPY --from=build /app/data ./data
COPY --from=build /app/lottery_previous_results.json ./lottery_previous_results.json
COPY --from=build /app/settings_loader.py ./settings_loader.py
COPY --from=build /app/lottery_checker.py ./lottery_checker.py

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000

CMD ["node", "server.js"]
