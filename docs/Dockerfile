FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY docs/package.json ./docs/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm install --workspace=docs --workspace=shared

# Copy source (volumes override in dev)
COPY tsconfig.json ./
COPY docs/ ./docs/
COPY shared/ ./shared/

WORKDIR /app/docs

EXPOSE 3003

CMD ["npm", "run", "dev"]
