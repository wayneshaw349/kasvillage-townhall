# ============================================================================
# KASVILLAGE TOWNHALL - DOCKER BUILD v2
# Multi-stage build: compile Rust ? minimal runtime
# ============================================================================

# Stage 1: Build
FROM rust:latest AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Pre-build dependencies with dummy main
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Now copy real source — touch Cargo.toml to invalidate cache
COPY src/main.rs src/main.rs
RUN touch src/main.rs && cargo build --release

# Verify binary size (should be 10+ MB)
RUN ls -la target/release/kasvillage-townhall && \
    SIZE=Dockerfile(stat -c%s target/release/kasvillage-townhall) && \
    echo "Binary size: DockerfileSIZE bytes" && \
    if [ DockerfileSIZE -lt 5000000 ]; then echo "ERROR: Binary too small!" && exit 1; fi

# Stage 2: Runtime
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/target/release/kasvillage-townhall /app/townhall

ENV PORT=8080
ENV KV_MODE=townhall
ENV RUST_LOG=info
EXPOSE 8080
CMD ["/app/townhall"]