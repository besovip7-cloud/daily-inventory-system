FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 10000

# تشغيل التهجير أولاً (آمن: CREATE TABLE IF NOT EXISTS) ثم تشغيل السيرفر
CMD ["sh", "-c", "node config/migrate.js && node server.js"]