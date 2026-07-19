# PostgreSQL Database Server
# Usage: docker build -f run/container/postgresql/Dockerfile .

FROM postgres:16-alpine

ENV POSTGRES_DB=cortex
ENV POSTGRES_USER=cortex
ENV POSTGRES_PASSWORD=cortex

VOLUME /var/lib/postgresql/data

EXPOSE 5432

CMD ["postgres"]
