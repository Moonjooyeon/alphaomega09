FROM postgres:16-alpine AS db-init
COPY scripts/init_production_database.sh /usr/local/bin/init_production_database
RUN chmod 0755 /usr/local/bin/init_production_database
ENTRYPOINT ["/bin/sh", "/usr/local/bin/init_production_database"]

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ARG VITE_GEMINI_ENDPOINT=/api/gemini
ARG VITE_API_BASE_ENDPOINT=/api
ARG VITE_TOSS_LOGIN_MOCK=false
ARG VITE_PURCHASE_MOCK=false
ARG VITE_TOSS_IAP_SKU=
ARG VITE_TOSS_AD_GROUP_ID=
ENV VITE_GEMINI_ENDPOINT=$VITE_GEMINI_ENDPOINT
ENV VITE_API_BASE_ENDPOINT=$VITE_API_BASE_ENDPOINT
ENV VITE_TOSS_LOGIN_MOCK=$VITE_TOSS_LOGIN_MOCK
ENV VITE_PURCHASE_MOCK=$VITE_PURCHASE_MOCK
ENV VITE_TOSS_IAP_SKU=$VITE_TOSS_IAP_SKU
ENV VITE_TOSS_AD_GROUP_ID=$VITE_TOSS_AD_GROUP_ID
COPY . .
RUN npm run build

FROM nginx:alpine AS web
COPY deploy/container-nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:20-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
EXPOSE 9090
CMD ["node", "server/index.js"]

FROM backend AS runtime
