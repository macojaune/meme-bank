# Production/Docker Development Dockerfile for MemeBank App
# Includes Node.js + whisper.cpp for local transcription

FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    g++ \
    make \
    cmake \
    ffmpeg \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies with the same pnpm release used to generate the lockfile.
RUN corepack enable && \
    corepack prepare pnpm@10.20.0 --activate && \
    pnpm install --frozen-lockfile

# Build and install whisper.cpp (using v1.6.2 stable version)
RUN git clone --branch v1.6.2 --depth 1 https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp && \
    cd /tmp/whisper.cpp && \
    cmake -B build \
        -DWHISPER_BUILD_TESTS=OFF \
        -DWHISPER_BUILD_EXAMPLES=ON \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=OFF && \
    cmake --build build --config Release --parallel $(nproc) && \
    cp build/bin/main /usr/local/bin/whisper-cli && \
    rm -rf /tmp/whisper.cpp

# Create models directory and download base model (74MB)
RUN mkdir -p /models && \
    wget -O /models/ggml-base.bin \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" \
    --progress=bar:force:noscroll

# Copy application code
COPY . .

# Build the application and fail the image build on TypeScript errors
RUN pnpm run build

# Adonis resolves the Vite manifest and other production assets from the
# compiled application root.
WORKDIR /app/build

# Set environment variables
ENV NODE_ENV=production
ENV WHISPER_MODEL_PATH=/models/ggml-base.bin
ENV WHISPER_CLI_PATH=/usr/local/bin/whisper-cli
ENV AI_PROVIDER=whispercpp

# Expose port
EXPOSE 63240

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:63240/health || exit 1

# Run migrations and the curated demo seed only when the environment opts in.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then node ace migration:run --force; fi; if [ \"$RUN_SEEDS\" = \"true\" ]; then node ace db:seed; fi; exec node bin/server.js"]
