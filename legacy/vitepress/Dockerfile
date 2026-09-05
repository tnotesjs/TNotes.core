FROM node:22.22.0-bookworm-slim

ENV COREPACK_HOME=/opt/corepack
ENV PATH=/opt/corepack:/toolchain/node_modules/.bin:$PATH
WORKDIR /toolchain

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
  && corepack prepare pnpm@10.17.1 --activate \
  && pnpm install --frozen-lockfile

COPY build.sh /toolchain/build.sh
RUN chmod +x /toolchain/build.sh

WORKDIR /workspace
ENTRYPOINT ["/toolchain/build.sh"]

