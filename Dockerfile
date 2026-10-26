FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY public ./public
# The quality dashboard is served at /reports/dashboard.html (README, capstone report)
COPY reports ./reports
ENV NODE_ENV=production PORT=3000 LLM_PROVIDER=claude
EXPOSE 3000
CMD ["node", "server.js"]
