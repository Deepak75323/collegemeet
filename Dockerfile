FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads production_logs

ENV NODE_ENV=production

# Railway injects PORT at runtime; keep 8000 as the local default
EXPOSE 8000

CMD ["node", "index.js"]
