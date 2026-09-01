# Use Node.js runtime base
FROM node:18-bullseye-slim

# Install system dependencies needed for Headless browser engines & localization rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    librender1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Establish runtime execution path inside workspace
WORKDIR /app

# Cache dependencies
COPY package.json ./
RUN npm install --production

# Download the required underlying Camoufox/Browser engine binaries inside container
RUN npx camoufox fetch

# Copy the rest of the application code
COPY . .

# Set container default entry point logic execution context flags
ENTRYPOINT ["node", "audit.js"]
