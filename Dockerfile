# KASVILLAGE TOWNHALL - DOCKER BUILD v3 (debug)
FROM rust:latest AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev cmake && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/main.rs src/main.rs
RUN touch src/main.rs && cargo build --release
RUN ldd target/release/kasvillage-townhall || echo "Static binary"
RUN ls -la target/release/kasvillage-townhall

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/kasvillage-townhall /app/townhall
RUN ldd /app/townhall || echo "Static or missing libs"
ENV PORT=33807
ENV KV_MODE=townhall
ENV RUST_LOG=info
EXPOSE 33807
CMD ["/app/townhall"]