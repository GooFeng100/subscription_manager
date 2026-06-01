FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json ./package.json
COPY frontend/tsconfig.json ./tsconfig.json
COPY frontend/vite.config.ts ./vite.config.ts
COPY frontend/index.html ./index.html
COPY frontend/env.d.ts ./env.d.ts
COPY frontend/src ./src

ARG VITE_APP_BASE_URL=http://192.168.10.3:8084
ENV VITE_APP_BASE_URL=${VITE_APP_BASE_URL}

RUN npm install
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
