# camoufox-js 0.12 requires Node >= 22.
FROM node:22-slim

# System runtime dependencies required by Camoufox's Firefox-based
# anti-fingerprint engine, plus build tooling for better-sqlite3 when no
# prebuilt binary is available for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libxtst6 \
    libx11-xcb1 \
    libxcb1 \
    libasound2 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Download the Camoufox browser engine itself (separate from npm install).
# CAMOUFOX_PATH keeps it inside the image instead of a per-user cache dir.
ENV CAMOUFOX_PATH=/opt/camoufox
RUN mkdir -p /opt/camoufox && npx camoufox-js fetch

COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
