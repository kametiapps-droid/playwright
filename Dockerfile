FROM node:18-slim

# Install system runtime dependencies required by Firefox anti-fingerprint engines
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-xcb1 \
    libasound2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

# Download the specific anti-fingerprinting engine asset payload directly
RUN npx camoufox fetch

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
