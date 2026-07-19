# Keycloak SSO Server
# Note: Keycloak official image 基於 RHEL UBI，無 Alpine 變體
# Build context: project root (../../..)
# Usage: docker build -f run/container/sso/keycloak/Dockerfile .

FROM quay.io/keycloak/keycloak:26.1 AS builder

ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

COPY third-party/keycloak/quarkus/ /tmp/keycloak-quarkus/

WORKDIR /tmp/keycloak-quarkus
RUN ./mvnw clean install -DskipTests -pl distributions/quarkus -am \
    && mkdir -p /opt/keycloak \
    && tar -xzf distributions/quarkus/target/keycloak-*.tar.gz -C /opt/keycloak --strip-components=1

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache bash gcompat libstdc++ openssl

COPY --from=builder /opt/keycloak /opt/keycloak

ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_HTTP_ENABLED=true
ENV KC_PROXY_HEADERS=xforwarded

EXPOSE 8080

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start"]
