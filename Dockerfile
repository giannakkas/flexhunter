FROM node:20-alpine

# Prisma needs openssl on Alpine
RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build:frontend

EXPOSE 3000
CMD ["npx", "tsx", "src/server/index.ts"]
