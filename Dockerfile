FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY server.js ./
COPY registration-result.json ./

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
