FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY public ./public
COPY server ./server
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
