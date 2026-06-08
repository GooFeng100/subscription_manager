FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.json ./tsconfig.json
COPY .eslintrc.cjs ./.eslintrc.cjs
COPY src ./src

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
