# llama.cpp Common Server
# General-purpose llama-server for text generation / chat
# Usage: docker build -f run/container/ai/common/Dockerfile .

FROM alpine:3.20 AS builder

RUN apk add --no-cache \
    build-base \
    cmake \
    git \
    curl \
    linux-headers

WORKDIR /build
RUN git clone --depth 1 https://github.com/ggerganov/llama.cpp.git

WORKDIR /build/llama.cpp
RUN cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-march=x86-64-v3" \
    -DCMAKE_CXX_FLAGS="-march=x86-64-v3" \
    -DLLAMA_CURL=OFF \
    && cmake --build build --config Release -j$(nproc)

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates libgomp

RUN adduser -D -s /bin/false llama

WORKDIR /app
COPY --from=builder /build/llama.cpp/build/bin/llama-server /app/llama-server

RUN mkdir -p /app/models /app/data && \
    chown -R llama:llama /app

USER llama

EXPOSE 8080

ENTRYPOINT ["/app/llama-server"]
CMD ["--host", "0.0.0.0", "--port", "8080"]
