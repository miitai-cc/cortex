# Qdrant Vector Database Server
# Build context: project root (../../..)
# Usage: docker build -f run/container/qdrant/Dockerfile .

FROM rust:1.80-alpine AS builder

RUN apk add --no-cache \
    musl-dev \
    cmake \
    g++ \
    openssl-dev \
    perl

WORKDIR /build
COPY third-party/qdrant/ .

RUN cargo build --release --bin qdrant

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates libgcc libstdc++ openssl

RUN adduser -D -s /bin/false qdrant

WORKDIR /qdrant
COPY --from=builder /build/target/release/qdrant /qdrant/qdrant

RUN mkdir -p /qdrant/storage /qdrant/snapshots && \
    chown -R qdrant:qdrant /qdrant

USER qdrant

EXPOSE 6333 6334

CMD ["/qdrant/qdrant"]
