FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY dist ./dist
COPY shared ./shared
ENV NODE_ENV=production
ENV PORT=5000
ENV SECTION=off
EXPOSE 5000
CMD ["dumb-init","node","dist/index.js"]
