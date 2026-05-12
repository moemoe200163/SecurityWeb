FROM node:20-bookworm AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# Production image
FROM debian:bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Node.js and Python with Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    locales \
    fonts-noto-cjk \
    && rm -rf /var/libapt/lists/*

# Set locale for Chinese
RUN sed -i -e 's/# zh_TW.UTF-8 UTF-8/zh_TW.UTF-8 UTF-8/' /etc/locale.gen && locale-gen zh_TW.UTF-8

# Install Node.js runtime
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright
RUN pip3 install --no-cache-dir --break-system-packages \
    playwright \
    jinja2 && \
    playwright install chromium && \
    playwright install-deps

# Install Docker CLI for sandbox access
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Copy Chinese font for PDF generation
COPY --from=builder /app/fonts ./fonts
COPY package.json ./

EXPOSE 4000

ENV PORT=4000
ENV DATABASE_URL="postgresql://user:pass@db:5432/securityweb"

CMD ["node", "dist/index.js"]
