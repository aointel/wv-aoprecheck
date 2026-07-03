# One image: install (with devDeps for Vite) → build client → run API with tsx
# Cache bust: 2026-05-21T20:57
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Railway injects PORT at runtime (often 8080)
EXPOSE 8080

# Avoid npx prompts in container
CMD ["./node_modules/.bin/tsx", "server/index.ts"]

