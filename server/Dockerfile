FROM node:18-alpine
WORKDIR /app

# Install only production deps for the webhook service
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || true

COPY server ./server

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server/paystack-webhook.mjs"]
