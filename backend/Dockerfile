FROM node:20-alpine AS build

WORKDIR /app

COPY backend/package.json ./package.json
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/.eslintrc.cjs ./.eslintrc.cjs
COPY backend/src ./src

RUN npm install
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY backend/package.json ./package.json
RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
