FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# .dockerignore loại .env, node_modules, tests -> secret chỉ đến từ env lúc chạy.
COPY --chown=node:node . .

USER node

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "src/server.js"]
