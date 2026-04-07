# Acacia Marketplace

Frontend isolado do marketplace em [`Marketplace/`](Marketplace/) para consumir o catálogo base já exposto pela API principal do jogo, sem subir uma API duplicada no runtime padrão.

## O que esta etapa entrega

- runtime padrão do marketplace reduzido ao site/frontend em [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml)
- configuração explícita da URL da API do jogo no frontend por [`Marketplace/public/runtime-config.js`](Marketplace/public/runtime-config.js) e [`Marketplace/docker/server.js`](Marketplace/docker/server.js)
- cliente Angular em [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) consumindo a API do jogo por base URL configurável
- home principal em [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts) exibindo que a fonte principal agora é a API do jogo e mantendo fallback visual local em falha
- backend auxiliar preservado em [`Marketplace/backend/`](Marketplace/backend/) para uso manual futuro, fora do compose padrão

## Arquitetura de runtime atual

Fluxo padrão:

1. o usuário sobe apenas o serviço [`marketplace`](Marketplace/docker/docker-compose.yml)
2. o container serve os assets estáticos via [`Marketplace/docker/server.js`](Marketplace/docker/server.js)
3. no startup, o servidor grava [`runtime-config.js`](Marketplace/public/runtime-config.js) no diretório publicado com a URL configurada em `MARKETPLACE_GAME_API_BASE_URL`
4. o frontend lê essa configuração e chama `GET /api/catalog/items` na API já existente do jogo
5. se a API do jogo falhar, a UI ativa apenas o fallback mockado local para manter a vitrine operável

Responsabilidades:

- **API do jogo**: fonte oficial do catálogo base
- **Marketplace frontend**: vitrine, filtros, checkout demo e consumo HTTP da API do jogo
- **Marketplace backend auxiliar**: artefato opcional para operações manuais, sem participação no runtime padrão

## Como a URL configurável da API foi implementada

A URL base do catálogo deixou de ser fixa em `http://localhost:3301`.

Agora o fluxo funciona assim:

- [`Marketplace/docker/server.js`](Marketplace/docker/server.js) lê `MARKETPLACE_GAME_API_BASE_URL`
- esse valor é materializado em [`Marketplace/public/runtime-config.js`](Marketplace/public/runtime-config.js) no formato `globalThis.__MARKETPLACE_RUNTIME_CONFIG__`
- [`Marketplace/src/index.html`](Marketplace/src/index.html) carrega esse arquivo antes do Angular inicializar
- [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) resolve `gameApiBaseUrl` em runtime e usa essa base para consultar `/api/catalog/items`

Fallbacks padrão:

- no frontend, se não houver configuração disponível, a base padrão continua sendo `http://localhost:9001`
- no compose Docker, o valor padrão é `http://host.docker.internal:9001`, assumindo a API principal do jogo disponível na máquina host

## Compose padrão sem backend duplicado

O arquivo [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml) agora sobe apenas:

- [`marketplace`](Marketplace/docker/docker-compose.yml)

O compose padrão não sobe mais:

- `marketplace-api`
- `marketplace-postgres`

Com isso:

- não existe mais bootstrap automático por [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js)
- não existe mais runtime duplicado lendo [`packages/server/data/items.json`](packages/server/data/items.json) ou [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
- a dependência da API do jogo passa a ser externa, explícita e configurável

## Como subir o runtime padrão do marketplace

No diretório [`Marketplace/`](Marketplace/):

```bash
cd Marketplace
docker compose -f docker/docker-compose.yml up --build
```

Porta padrão da UI:

- site: `4201`

Variável principal do runtime:

- `MARKETPLACE_GAME_API_BASE_URL`: URL HTTP da API já existente do jogo usada pelo frontend

Exemplo com valor explícito:

```bash
cd Marketplace
set MARKETPLACE_GAME_API_BASE_URL=http://host.docker.internal:9001
docker compose -f docker/docker-compose.yml up --build
```

Se a API do jogo estiver em outro host ou porta, basta ajustar essa variável antes de subir o compose.

## Como instalar dependências locais

```bash
cd Marketplace
npm install
```

## Backend auxiliar mantido para uso manual

O diretório [`Marketplace/backend/`](Marketplace/backend/) continua no repositório como artefato auxiliar.

Ele ainda pode ser usado manualmente para:

- gerar seed SQL por [`Marketplace/backend/generate-seed-sql.js`](Marketplace/backend/generate-seed-sql.js)
- importar catálogo em Postgres por [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js)
- subir a API auxiliar por [`Marketplace/backend/server.js`](Marketplace/backend/server.js)
- inspecionar catálogo persistido por [`Marketplace/backend/list-catalog-items.js`](Marketplace/backend/list-catalog-items.js)

Esses fluxos não fazem mais parte do runtime padrão do marketplace.

## Fluxos manuais ainda disponíveis

### Gerar ou regenerar o seed versionado

```bash
cd Marketplace
npm run catalog:seed
```

### Aplicar schema, seed e views manualmente

```bash
cd Marketplace
npm run catalog:import
```

### Listar o catálogo persistido manualmente

```bash
cd Marketplace
npm run catalog:list
```

### Subir a API auxiliar manualmente

```bash
cd Marketplace
npm run api:start
```

API auxiliar padrão:

- `http://localhost:3301`

## Estrutura relevante

- [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml): runtime padrão apenas com o frontend
- [`Marketplace/docker/server.js`](Marketplace/docker/server.js): servidor estático que injeta a configuração de runtime
- [`Marketplace/public/runtime-config.js`](Marketplace/public/runtime-config.js): arquivo-base de configuração carregado pelo frontend
- [`Marketplace/src/index.html`](Marketplace/src/index.html): carrega `runtime-config.js` antes do Angular
- [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts): resolve a base URL configurável da API do jogo
- [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts): comunica na UI que a fonte principal é a API do jogo
- [`Marketplace/backend/server.js`](Marketplace/backend/server.js): backend auxiliar preservado para uso manual
- [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js): importação manual opcional
- [`Marketplace/package.json`](Marketplace/package.json): scripts operacionais

## Observações da iteração

- o problema de runtime foi tratado removendo a duplicação operacional do backend do marketplace
- o frontend do marketplace agora é um consumidor explícito da API principal do jogo
- o backend auxiliar foi mantido sem participar do compose padrão
- a solução permanece pequena, direta e alinhada ao plano em [`.vibecoding/plan/marketplace-catalog-decoupling.md`](.vibecoding/plan/marketplace-catalog-decoupling.md)
