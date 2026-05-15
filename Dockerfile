# ============================================================================
# KASVILLAGE TOWNHALL - DOCKER BUILD
# Multi-stage build: compile Rust → minimal runtime
# ============================================================================

# Stage 1: Build
FROM rust:latest AS builder

WORKDIR /app

# Install build dependencies for Halo2 + crypto
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Create dummy main for dependency pre-build
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src target/release/kasvillage-townhall

# Copy actual source
COPY src/main.rs src/main.rs

# Build release
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/kasvillage-townhall /app/townhall

# Environment defaults
ENV PORT=8080
ENV KV_MODE=townhall
ENV RUST_LOG=info

EXPOSE 8080

CMD ["/app/townhall"]
