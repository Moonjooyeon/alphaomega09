FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ARG VITE_GEMINI_ENDPOINT=/api/gemini
ARG VITE_API_BASE_ENDPOINT=/api
ARG VITE_TOSS_LOGIN_MOCK=false
ENV VITE_GEMINI_ENDPOINT=$VITE_GEMINI_ENDPOINT
ENV VITE_API_BASE_ENDPOINT=$VITE_API_BASE_ENDPOINT
ENV VITE_TOSS_LOGIN_MOCK=$VITE_TOSS_LOGIN_MOCK
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "server/index.js"]
