# Use Playwright's official image — Chromium + all OS deps already installed
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json ./
RUN npm install

# Copy app source
COPY audit.js ./

# Default entrypoint: node audit.js <url>
# Example: docker run --rm page-audit https://example.com
ENTRYPOINT ["node", "audit.js"]
CMD ["https://example.com"]
