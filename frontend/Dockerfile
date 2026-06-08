FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts
COPY index.html ./index.html
COPY env.d.ts ./env.d.ts
COPY public ./public
COPY src ./src

ARG VITE_APP_BASE_URL=http://192.168.10.3:8084
ENV VITE_APP_BASE_URL=${VITE_APP_BASE_URL}

RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
