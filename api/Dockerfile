FROM node:20-alpine

# yt-dlp powers the /api/youtube/* routes (extract, formats, download). ffmpeg is
# required to merge YouTube's separate video+audio (DASH) streams for 1080p+
# downloads and to transcode audio to mp3. Installed via pip to stay current; the
# prebuilt yt-dlp_linux binary is glibc and won't run on Alpine/musl.
RUN apk add --no-cache python3 py3-pip ffmpeg \
    && python3 -m pip install --break-system-packages --no-cache-dir -U yt-dlp

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm install --workspace=api --workspace=shared

# Copy source (volumes override in dev)
COPY tsconfig.json ./
COPY api/ ./api/
COPY shared/ ./shared/
COPY migrations/ ./migrations/

WORKDIR /app/api

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

CMD ["npm", "run", "dev"]
