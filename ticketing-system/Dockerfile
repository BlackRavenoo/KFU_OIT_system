FROM lukemathwalker/cargo-chef:latest-rust-1.88 AS chef
WORKDIR /app
RUN apt update && apt install lld clang -y

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

WORKDIR /app
COPY . .
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin ticketing-system

FROM debian:bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/ticketing-system server/ticketing-system
COPY configuration server/configuration
COPY keys server/keys
ENV APP_ENV=production
WORKDIR /app/server
ENTRYPOINT ["./ticketing-system"]