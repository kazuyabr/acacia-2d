FROM node:18-bullseye

WORKDIR /app

# Adicionar dependências necessárias
RUN apt-get update -y && apt-get install -y \
    python3 \
    git \
    libvips-dev \
    build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar todo o código fonte
COPY ../ .

# Habilitar corepack
RUN corepack enable

RUN rm -rf node_modules \
    rm -rf packages/*/node_modules


# Instalar dependências e construir
RUN yarn
RUN yarn postinstall
RUN yarn build

EXPOSE 5183 9001 9002 9003 9526 9527 9528


CMD ["yarn", "dev"]
