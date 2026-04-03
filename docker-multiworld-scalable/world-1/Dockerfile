FROM node:20-bullseye

WORKDIR /app

RUN apt-get update -y && apt-get install -y \
    python3 \
    git \
    libvips-dev \
    build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN corepack enable
RUN rm -rf node_modules packages/*/node_modules

RUN yarn
RUN npx update-browserslist-db@latest
RUN yarn up -R caniuse-lite baseline-browser-mapping
RUN yarn postinstall
RUN yarn build

EXPOSE 9101 9102
