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

# Production image - lean backend API
FROM debian:bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only what's needed for the backend API
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    fonts-noto-cjk \
    locales \
    && rm -rf /var/libapt/lists/*

# Set locale for Chinese - debian slim uses locales-all or needs locale-gen
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && \
    echo "zh_TW.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen

# Install Node.js runtime only
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Copy Chinese font for PDF generation (pdfkit uses bundled fonts, but we keep for fallback)
COPY --from=builder /app/fonts ./fonts
COPY package.json ./

EXPOSE 4000

ENV PORT=4000
ENV DATABASE_URL="postgresql://user:pass@db:5432/securityweb"

CMD ["node", "dist/index.js"]