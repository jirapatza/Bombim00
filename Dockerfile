FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci; \
    else npm ci; fi
COPY . .
ARG VITE_LOTTERY_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
ENV PORT=10000
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 10000
