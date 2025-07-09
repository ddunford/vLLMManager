# Build stage for frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --only=production

COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:18-slim

# Create non-root user
RUN groupadd -r vllm && useradd -r -g vllm vllm

# Install Docker CLI, curl for health checks, and nvidia-smi for GPU detection
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Note: nvidia-smi will be available automatically when GPU access is granted via Docker Compose
# and the NVIDIA Container Toolkit is properly configured on the host

WORKDIR /app

# Copy backend package.json and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY server/ ./server/

# Copy frontend build from previous stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create data directory for SQLite and logs with proper permissions
RUN mkdir -p ./server/data ./server/logs && \
    chown -R vllm:vllm /app

# Switch to non-root user
USER vllm

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["npm", "start"] 