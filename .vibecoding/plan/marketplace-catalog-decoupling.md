# Objetivo

Remover a duplicação da API de itens no marketplace e alinhar [`Marketplace/`](Marketplace/) ao fato de que o catálogo base do jogo já é servido fora de [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml).

## Contexto

A arquitetura atual sobe um serviço duplicado [`marketplace-api`](Marketplace/docker/docker-compose.yml) que executa [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js) e [`Marketplace/backend/server.js`](Marketplace/backend/server.js) para reconstruir um catálogo em Postgres a partir de arquivos locais do monorepo. Isso cria dois problemas:

- dependência incorreta de [`packages/server/data/items.json`](packages/server/data/items.json) e [`packages/client/data/sprites.json`](packages/client/data/sprites.json) via [`Marketplace/backend/game-items-source.js`](Marketplace/backend/game-items-source.js)
- acoplamento operacional entre o site do marketplace e uma API duplicada que tenta reproduzir dados já disponíveis no serviço principal do jogo

O frontend hoje depende diretamente dessa API local fixa em [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts), com base padrão `http://localhost:3301`.

## Decisões aplicadas

- Manter a regra de fonte única de verdade do sistema descrita em [`.vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md): o marketplace não deve recriar em runtime um segundo backend para dados que já pertencem ao runtime principal do jogo.
- Tratar o catálogo base de itens como responsabilidade do serviço principal do jogo, não de [`Marketplace/backend/server.js`](Marketplace/backend/server.js).
- Permitir backend próprio do marketplace apenas para funções realmente específicas de marketplace, como curadoria comercial, pedidos, pagamentos ou leitura de catálogo curado próprio. Não manter backend apenas para espelhar itens do jogo.

## Estratégia

Substituir a arquitetura atual por uma separação simples:

1. [`Marketplace/`](Marketplace/) passa a ser um frontend estático isolado.
2. O frontend consome a API já existente do jogo para obter os itens base.
3. O compose do marketplace sobe apenas o site estático, sem [`marketplace-api`](Marketplace/docker/docker-compose.yml) e sem bootstrap de itens locais.
4. Qualquer backend futuro do marketplace, se necessário, deve ser restrito a capacidades próprias de marketplace e consumir a API do jogo ou um catálogo já curado, nunca reconstruir itens a partir de arquivos montados no container.

## Arquitetura recomendada

### 1. Arquitetura substituta

Arquitetura alvo:

- **Jogo**: continua sendo a fonte da API de itens
- **Marketplace frontend**: consome a API externa do jogo por configuração
- **Marketplace backend**: opcional e desacoplado; não participa do carregamento base de itens

Fluxo alvo:

1. O usuário acessa o site servido por [`Marketplace/docker/server.js`](Marketplace/docker/server.js).
2. O frontend chama a API já existente do jogo em URL configurável.
3. A vitrine mapeia a resposta para o modelo atual de produto.
4. Em falha de rede, mantém fallback visual local já existente, sem exigir banco nem importação local de itens.

### 2. Destino do backend próprio

Recomendação principal: **reduzir e retirar do runtime padrão do marketplace**.

Interpretação prática:

- [`Marketplace/backend/server.js`](Marketplace/backend/server.js) deixa de ser parte obrigatória da subida do site.
- [`Marketplace/backend/generate-seed-sql.js`](Marketplace/backend/generate-seed-sql.js) e [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js) deixam de ser mecanismo de bootstrap do marketplace em Docker.
- O backend só deve permanecer se houver necessidade comprovada de funções específicas de marketplace, por exemplo catálogo comercial curado, preços, estoque de ofertas, pedidos ou integração de pagamento.
- Se essas funções não forem necessárias agora, o backend pode entrar em trilha de remoção posterior.

### 3. Carregamento do catálogo sem arquivos locais do jogo

O catálogo deve ser carregado por **integração HTTP com a API do jogo**, não por leitura local de arquivos dentro do container.

Consequências:

- [`Marketplace/backend/game-items-source.js`](Marketplace/backend/game-items-source.js) deixa de ser dependência do runtime do marketplace.
- O container do marketplace não precisa mais acessar [`packages/server/data/items.json`](packages/server/data/items.json) nem [`packages/client/data/sprites.json`](packages/client/data/sprites.json).
- A transformação do frontend em [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) continua útil, mas deve passar a consumir uma base URL configurável da API real do jogo.

### 4. Docker isolado do marketplace

O compose de [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml) deve subir isoladamente com foco apenas em entregar o site.

Direção recomendada:

- remover `marketplace-api` do compose do marketplace
- remover `marketplace-postgres` do compose padrão do marketplace, a menos que exista uso imediato e comprovado para dados próprios de marketplace
- manter apenas o serviço `marketplace` para servir os assets estáticos
- parametrizar no frontend a URL da API do jogo já existente fora desse compose

Resultado esperado:

- `docker compose` do marketplace sobe sem copiar ou reconstruir dados do jogo
- o site funciona isoladamente como frontend
- a dependência operacional da API do jogo passa a ser externa e explícita, em vez de escondida dentro do compose do marketplace

## Etapas

1. Definir a API do jogo como fonte oficial do catálogo consumido pelo marketplace e registrar essa decisão em documentação do módulo.
2. Ajustar a estratégia do frontend em [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) para usar URL configurável da API do jogo em vez de `http://localhost:3301` fixo.
3. Simplificar [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml) para subir apenas o site estático.
4. Remover do fluxo padrão de runtime as etapas de importação local baseadas em [`Marketplace/backend/generate-seed-sql.js`](Marketplace/backend/generate-seed-sql.js) e [`Marketplace/backend/import-game-items.js`](Marketplace/backend/import-game-items.js).
5. Reavaliar depois se o backend do marketplace ainda tem função própria suficiente para permanecer no repositório.

## Riscos

- Se a API atual do jogo não expuser exatamente o shape esperado pelo frontend, será necessário adaptar o mapper do frontend ou criar uma camada mínima de compatibilidade.
- Se houver requisitos de curadoria comercial hoje armazenados apenas em Postgres do marketplace, a remoção total do backend não deve acontecer antes de separar claramente esses dados dos itens-base do jogo.
- O uso de URL fixa no frontend impede ambientes diferentes; a configuração deve ser externalizada para evitar novo acoplamento.

## Observações

- O problema principal não é apenas falha de leitura de itens; é a definição incorreta de responsabilidade entre jogo e marketplace.
- [`Marketplace/backend/server.js`](Marketplace/backend/server.js) hoje funciona como espelho local de catálogo persistido, não como capacidade exclusiva de marketplace.
- O caminho mais seguro é desacoplar primeiro o consumo do catálogo no frontend e o compose Docker; a remoção física completa do backend pode vir em etapa seguinte, após validação de que não resta função exclusiva.

## Próximo passo de implementação mais seguro

Executar primeiro a **troca da fonte do frontend**: fazer [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) consumir uma URL configurável da API já existente do jogo e, em seguida, ajustar [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml) para subir apenas o site estático.