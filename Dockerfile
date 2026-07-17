# Build stage
FROM rust:1.80-slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    clang \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/
COPY lib/rust/Cargo.toml lib/rust/

RUN mkdir -p backend/src lib/rust/src && \
    echo "fn main() {}" > backend/src/main.rs && \
    echo "// placeholder" > lib/rust/src/lib.rs && \
    cargo build --release 2>/dev/null || true

COPY . .
RUN cargo build --release --package cortex-backend

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/cortex-backend /app/cortex-backend
COPY --from=builder /app/backend/.env /app/backend/.env

RUN mkdir -p /app/data /app/uploads

EXPOSE 8080

CMD ["./cortex-backend"]
