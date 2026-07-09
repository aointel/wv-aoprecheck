FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY dist ./dist
COPY shared ./shared
ENV NODE_ENV=production
ENV PORT=5000
ENV SECTION=precheck
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["dumb-init","npx","cross-env","SECTION=precheck","node","dist/index.js"]
