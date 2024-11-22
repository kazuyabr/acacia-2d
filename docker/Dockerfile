FROM node:18-alpine

WORKDIR /app

# Adicionar dependências necessárias
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    vips-dev \
    build-base

# Habilitar corepack
RUN corepack enable

# Copiar todo o código fonte primeiro
COPY . .

# Instalar dependências e construir
RUN yarn
RUN yarn postinstall

EXPOSE 9001 9002 9526 9527

# Usar o script diretamente do package.json
CMD ["yarn", "dev"]
