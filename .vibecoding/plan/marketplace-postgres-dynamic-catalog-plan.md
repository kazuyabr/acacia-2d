# Objetivo

Planejar a evolução do marketplace em [`Marketplace/`](Marketplace/) para operar como vitrine real e dinâmica baseada em todos os itens do jogo, com catálogo persistido em Postgres, pré-cadastro completo dos itens e consumo exclusivo do catálogo persistido por backend e frontend.

---

# Contexto

O estado atual já contém uma primeira trilha de catálogo real em [`Marketplace/backend/game-items-source.js`](Marketplace/backend/game-items-source.js), [`Marketplace/backend/catalog.repository.js`](Marketplace/backend/catalog.repository.js), [`Marketplace/backend/schema.sql`](Marketplace/backend/schema.sql) e [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts), mas ainda com acoplamento de schema dentro de [`Marketplace/backend/`](Marketplace/backend/) e sem uma organização dedicada para arquivos SQL em [`Marketplace/postgres/`](Marketplace/postgres/).

A fonte de verdade dos itens do jogo está no monorepo principal, com base primária em [`packages/server/data/items.json`](packages/server/data/items.json), complementada pela tipagem em [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts), pela forma como o runtime resolve dados em [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts) e pelo índice visual disponível em [`packages/client/data/sprites.json`](packages/client/data/sprites.json).

O plano desta etapa fica limitado a futuras alterações dentro de [`Marketplace/`](Marketplace/), sem mover a fonte de verdade do jogo para fora de [`packages/`](packages/), e sem depender de integração PIX/PixGo para o catálogo público.

---

# Decisões aplicadas

- A fonte estrutural primária dos itens continua sendo [`packages/server/data/items.json`](packages/server/data/items.json).
- A resolução do identificador visual do item deve seguir a mesma lógica do runtime do jogo em [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts): usar `spriteName` quando existir; caso contrário, usar o próprio `item_id` do jogo.
- A verificação de existência de sprite deve usar [`packages/client/data/sprites.json`](packages/client/data/sprites.json) como índice de referência para imagens publicáveis do catálogo.
- O marketplace deve consumir apenas catálogo persistido em Postgres; leitura direta de [`packages/server/data/items.json`](packages/server/data/items.json) fica restrita ao processo de geração/importação inicial.
- A regra comercial é preservada por campos explícitos de catálogo: `can_sell` e `price_brl`. Item sem `can_sell = true` ou sem preço válido não entra na vitrine pública.
- A integração futura com PIX/PixGo permanece desacoplada do catálogo. O catálogo deve existir e funcionar independentemente de [`Marketplace/src/app/core/pix.providers.ts`](Marketplace/src/app/core/pix.providers.ts) e dos fluxos de checkout em [`Marketplace/src/app/core/services/marketplace-workflow.service.ts`](Marketplace/src/app/core/services/marketplace-workflow.service.ts).
- Os arquivos SQL devem ser externalizados para [`Marketplace/postgres/`](Marketplace/postgres/) e se tornar a fonte de verdade relacional do marketplace.

---

# Estratégia

## 1. Extrair um inventário técnico completo dos itens

Consolidar um pipeline de leitura a partir de:

- [`packages/server/data/items.json`](packages/server/data/items.json) para `item_id`, nome, tipo, atributos, descrição e metadados brutos.
- [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts) para determinar o conjunto de atributos relevantes possíveis e o formato esperado de stats/bonuses.
- [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts) para reproduzir a normalização usada pelo jogo, principalmente `spriteName -> key`, `type`, `level`, `skill`, `attackStats`, `defenseStats`, `bonuses`, `description`, `weaponType`, `projectileName`, flags e atributos especiais.
- [`packages/client/data/sprites.json`](packages/client/data/sprites.json) para verificar se existe sprite listada em formato `items/<sprite_key>`.

## 2. Persistir todos os itens em catálogo relacional único

Criar uma tabela principal de catálogo em Postgres contendo todos os itens do jogo, inclusive itens não vendáveis inicialmente. O estado comercial fica no próprio catálogo persistido, não na fonte do jogo.

## 3. Separar SQL de schema, seed e suporte

Migrar a definição relacional para [`Marketplace/postgres/`](Marketplace/postgres/) com arquivos dedicados para criação do schema, carga inicial e objetos auxiliares como índices e views.

## 4. Fazer backend e frontend dependerem apenas do banco

Após a carga inicial, [`Marketplace/backend/server.js`](Marketplace/backend/server.js) e os serviços Angular em [`Marketplace/src/`](Marketplace/src/) devem consultar somente a API do catálogo persistido. Nenhuma rota pública deve depender de leitura direta do arquivo [`packages/server/data/items.json`](packages/server/data/items.json).

---

# Resposta objetiva ao item 1 — arquivos em [`packages/`](packages/) que devem ser lidos

## Arquivos obrigatórios

1. [`packages/server/data/items.json`](packages/server/data/items.json)
   - fonte canônica de todos os itens do jogo
   - contém `type`, `name`, `description`, `spriteName`, `skill`, `level`, `attackStats`, `defenseStats`, `bonuses`, `weaponType`, `projectileName`, flags e atributos especiais

2. [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts)
   - contrato dos campos possíveis de `ItemData`
   - define o conjunto de atributos relevantes que o seed deve reconhecer e/ou preservar em metadado bruto

3. [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts)
   - mostra a normalização real usada pelo jogo
   - confirma que a chave visual efetiva do item é `spriteName || item_id`
   - confirma quais atributos são efetivamente carregados no runtime

4. [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
   - índice factual de sprites existentes no cliente
   - deve ser usado para validar `items/<resolved_image_key>` e detectar gaps de imagem

## Arquivos úteis complementares

5. [`packages/server/src/controllers/entities.ts`](packages/server/src/controllers/entities.ts)
   - útil para confirmar que [`packages/server/data/items.json`](packages/server/data/items.json) segue como fonte carregada pelo servidor

6. [`packages/common/types/slot.d.ts`](packages/common/types/slot.d.ts)
   - útil para alinhar como `attackStats`, `defenseStats` e `bonuses` aparecem em contextos consumidos pelo jogo

7. [`packages/server/src/controllers/stores.ts`](packages/server/src/controllers/stores.ts)
   - útil apenas como referência de semântica comercial do jogo (`price` interno e venda/compra in-game), sem reutilizar esse preço como `price_brl`

## Regra prática de extração

- catálogo base: ler sempre [`packages/server/data/items.json`](packages/server/data/items.json)
- imagem: resolver por `itemData.spriteName ?? item_id`, depois validar existência em [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
- atributos relevantes: extrair no mínimo os campos previstos em [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts) e efetivamente carregados em [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts)

---

# Resposta objetiva ao item 2 — schema SQL final

## Tabela principal recomendada: `catalog_items`

Campos finais recomendados:

- `id BIGSERIAL PRIMARY KEY`
- `item_id TEXT NOT NULL UNIQUE`
- `name TEXT NOT NULL`
- `image_key TEXT NULL`
- `image_path TEXT NULL`
- `image_source TEXT NULL`
- `category TEXT NOT NULL`
- `subcategory TEXT NULL`
- `required_skill TEXT NULL`
- `required_level INTEGER NULL`
- `weapon_type TEXT NULL`
- `attack_stats JSONB NOT NULL DEFAULT '{}'::JSONB`
- `defense_stats JSONB NOT NULL DEFAULT '{}'::JSONB`
- `bonuses JSONB NOT NULL DEFAULT '{}'::JSONB`
- `status_summary JSONB NOT NULL DEFAULT '{}'::JSONB`
- `description TEXT NULL`
- `stackable BOOLEAN NOT NULL DEFAULT FALSE`
- `max_stack INTEGER NOT NULL DEFAULT 1`
- `projectile_name TEXT NULL`
- `metadata_raw JSONB NOT NULL`
- `metadata_game JSONB NOT NULL DEFAULT '{}'::JSONB`
- `can_sell BOOLEAN NOT NULL DEFAULT FALSE`
- `price_brl NUMERIC(10,2) NULL`
- `is_image_mapped BOOLEAN NOT NULL DEFAULT FALSE`
- `last_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

## Semântica esperada dos campos

- `item_id`: chave original do jogo, ex. `coppersword`
- `name`: nome original do item vindo do jogo
- `image_key`: chave visual resolvida por `spriteName || item_id`
- `image_path`: caminho lógico público, ex. `items/coppersword`
- `image_source`: origem usada para mapear imagem, ex. `packages/client/data/sprites.json`
- `category`: valor principal de `type`
- `subcategory`: opcional para refinamento futuro; exemplo: `weaponType` ou agrupamento comercial derivado
- `required_skill`: valor de `skill`
- `required_level`: valor de `level`
- `attack_stats`: payload bruto de `attackStats`
- `defense_stats`: payload bruto de `defenseStats`
- `bonuses`: payload bruto de `bonuses`
- `status_summary`: recorte normalizado para facilitar API/filtros, incluindo campos como `atk`, `def`, `accuracy`, `strength`, `archery`, `magic`, `attack_rate`, `attack_range`, `movement_modifier`, `heal_amount`, `mana_amount`
- `metadata_raw`: objeto bruto original do item em [`packages/server/data/items.json`](packages/server/data/items.json)
- `metadata_game`: objeto normalizado com campos adicionais úteis ao marketplace
- `can_sell`: regra comercial principal
- `price_brl`: preço comercial em real
- `is_image_mapped`: indica se o `image_key` foi confirmado em [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
- timestamps: trilha de criação, atualização e última importação

## Regras de integridade recomendadas

- `UNIQUE (item_id)`
- `CHECK (price_brl IS NULL OR price_brl >= 0)`
- `CHECK (max_stack >= 1)`
- `CHECK (NOT can_sell OR price_brl IS NOT NULL)` para impedir item publicável sem preço

## View pública recomendada: `vw_catalog_sellable_items`

Expor apenas itens com:

- `can_sell = true`
- `price_brl IS NOT NULL`

Essa view simplifica o consumo do backend público.

---

# Resposta objetiva ao item 3 — arquivos SQL em [`Marketplace/postgres/`](Marketplace/postgres/)

## Estrutura recomendada

- [`Marketplace/postgres/001_schema.sql`](Marketplace/postgres/001_schema.sql)
- [`Marketplace/postgres/002_seed_game_items.sql`](Marketplace/postgres/002_seed_game_items.sql)
- [`Marketplace/postgres/003_indexes_and_views.sql`](Marketplace/postgres/003_indexes_and_views.sql)
- [`Marketplace/postgres/README.md`](Marketplace/postgres/README.md)

## Papel de cada arquivo

### [`Marketplace/postgres/001_schema.sql`](Marketplace/postgres/001_schema.sql)

Deve criar:

- tabela `catalog_items`
- trigger/função para atualizar `updated_at`, se o backend optar por não controlar isso manualmente
- tabela opcional `catalog_import_runs` para rastrear importações

### [`Marketplace/postgres/002_seed_game_items.sql`](Marketplace/postgres/002_seed_game_items.sql)

Deve conter:

- carga inicial de todos os itens reais do jogo
- `INSERT ... ON CONFLICT (item_id) DO UPDATE`
- preservação dos campos comerciais existentes (`can_sell`, `price_brl`) durante reimportações
- default inicial `can_sell = false`
- default inicial `price_brl = NULL`

### [`Marketplace/postgres/003_indexes_and_views.sql`](Marketplace/postgres/003_indexes_and_views.sql)

Deve conter ao menos:

- índice por `can_sell`
- índice por `category`
- índice por `required_skill`
- índice por `is_image_mapped`
- índice opcional por `price_brl`
- índice opcional GIN em `status_summary` ou `metadata_game`, se os filtros exigirem busca por stats
- view `vw_catalog_sellable_items`
- view opcional `vw_catalog_image_gaps` para auditoria de imagens sem mapeamento

### [`Marketplace/postgres/README.md`](Marketplace/postgres/README.md)

Deve documentar:

- origem dos dados do seed
- ordem de execução dos SQLs
- regra de preservação comercial
- como regenerar o seed

---

# Resposta objetiva ao item 4 — como o seed SQL deve ser gerado

## Estratégia recomendada

O seed SQL não deve ser escrito manualmente. Ele deve ser gerado a partir da estrutura real do projeto por um gerador dentro de [`Marketplace/backend/`](Marketplace/backend/) ou pasta equivalente interna de utilitários do marketplace.

## Fonte real do gerador

O gerador deve ler, nesta ordem lógica:

1. [`packages/server/data/items.json`](packages/server/data/items.json)
2. [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts)
3. [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts)
4. [`packages/client/data/sprites.json`](packages/client/data/sprites.json)

## Transformações mínimas do gerador

Para cada item:

1. usar a chave do objeto como `item_id`
2. copiar `name` para `name`
3. copiar `type` para `category`
4. copiar `skill` para `required_skill`
5. copiar `level` para `required_level`
6. copiar `weaponType` para `weapon_type`
7. copiar `attackStats`, `defenseStats` e `bonuses` para colunas JSONB próprias
8. montar `status_summary` com resumo achatado dos atributos numéricos principais
9. resolver `image_key = spriteName ?? item_id`
10. validar se `items/<image_key>` existe em [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
11. preencher `image_path`, `image_source` e `is_image_mapped`
12. gravar o item bruto completo em `metadata_raw`
13. gravar metadados normalizados em `metadata_game`
14. inicializar `can_sell = false`
15. inicializar `price_brl = NULL`

## Forma de saída recomendada

Gerar um arquivo SQL determinístico em [`Marketplace/postgres/002_seed_game_items.sql`](Marketplace/postgres/002_seed_game_items.sql) contendo:

- cabeçalho explicando origem e data de geração
- `INSERT INTO catalog_items (...) VALUES ...`
- `ON CONFLICT (item_id) DO UPDATE SET ...`
- preservação explícita de `can_sell` e `price_brl` já existentes

## Limitações e consolidações necessárias

1. [`packages/server/data/items.json`](packages/server/data/items.json) não garante imagem pronta para todos os itens; alguns itens dependem de `spriteName` e outros apenas do `item_id`.
2. [`packages/client/data/sprites.json`](packages/client/data/sprites.json) é um índice de sprite, não um manifesto rico com URL final, dimensões ou CDN pública.
3. Parte dos status relevantes é heterogênea: alguns itens têm `attackStats`, outros só `bonuses`, outros têm `healAmount`, `manaAmount`, `movementModifier`, `mining`, `fishing` ou `pet`.
4. Por isso, o gerador precisa consolidar um `status_summary` mínimo comum e deixar o restante em `metadata_raw`/`metadata_game`.
5. `price` do jogo, quando existir em [`packages/server/data/items.json`](packages/server/data/items.json), não deve virar `price_brl`; ele pode ser preservado apenas como metadado interno.

---

# Resposta objetiva ao item 5 — como backend e frontend devem consumir apenas o catálogo persistido

## Backend em [`Marketplace/backend/`](Marketplace/backend/)

### Direção

[`Marketplace/backend/server.js`](Marketplace/backend/server.js) deve deixar de expor a origem em arquivo como fonte operacional e passar a usar somente consultas ao Postgres.

### Ajustes planejados

1. manter a leitura de [`packages/server/data/items.json`](packages/server/data/items.json) apenas no gerador/importador
2. mover o schema SQL referenciado por [`Marketplace/backend/schema.js`](Marketplace/backend/schema.js) para [`Marketplace/postgres/`](Marketplace/postgres/)
3. adaptar [`Marketplace/backend/catalog.repository.js`](Marketplace/backend/catalog.repository.js) para consultar os novos campos (`item_id`, `name`, `image_path`, `status_summary`, `can_sell`, `price_brl`)
4. manter reimportação por upsert, sem sobrescrever curadoria comercial
5. usar a view `vw_catalog_sellable_items` para endpoints públicos

## Frontend Angular em [`Marketplace/src/`](Marketplace/src/)

### Direção

O frontend deve depender só da API do marketplace. Nenhum componente deve usar [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) como fonte principal.

### Ajustes planejados

1. transformar [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) no único cliente de catálogo
2. adaptar [`Marketplace/src/app/core/models/marketplace.models.ts`](Marketplace/src/app/core/models/marketplace.models.ts) para refletir o contrato persistido final
3. remover o uso principal de [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts)
4. fazer [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts) e o fluxo de home/renderização consumirem apenas itens vindos da API
5. manter o fluxo de checkout referenciando `item_id` persistido, não SKU mockado

---

# Resposta objetiva ao item 6 — gaps de imagem

## Gap principal

Não há, no material lido, um manifesto dedicado do marketplace que mapeie `item_id -> URL pública de imagem`.

## O que existe de fato

- [`packages/server/data/items.json`](packages/server/data/items.json) fornece `spriteName` apenas em alguns casos
- [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts) confirma a regra `spriteName || item_id`
- [`packages/client/data/sprites.json`](packages/client/data/sprites.json) apenas confirma a existência do sprite lógico, por exemplo `items/coppersword`

## Gaps concretos

1. ausência de URL final pública pronta para o Angular
2. ausência de garantia de que todo item em [`packages/server/data/items.json`](packages/server/data/items.json) tenha correspondente em [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
3. ausência de manifesto com metadados visuais como tamanho, fallback, categoria visual ou asset derivado para e-commerce
4. possível divergência entre itens equipáveis do player (`player/weapon/...`) e sprites de inventário (`items/...`)

## Estratégia planejada para o gap

- considerar `items/<image_key>` como identidade visual lógica inicial
- registrar em banco `is_image_mapped`
- criar view de auditoria para itens sem sprite confirmada
- prever fallback visual no frontend para itens sem imagem válida
- adiar qualquer normalização de asset final/CDN para etapa posterior, sem bloquear o catálogo persistido

---

# Resposta objetiva ao item 7 — endpoints e filtros mínimos para home dinâmica

## Endpoints mínimos

### Público

1. `GET /api/catalog/home`
   - retorna itens publicáveis para a home
   - usa somente `vw_catalog_sellable_items`
   - suporta paginação e filtros simples

2. `GET /api/catalog/items/:itemId`
   - retorna detalhe de um item publicável
   - usado para tela de detalhe ou checkout

3. `GET /api/catalog/filters`
   - retorna agregações mínimas para montar filtros da home
   - exemplos: categorias disponíveis, skills, faixas de preço, flag de imagem disponível

### Operacional interno

4. `GET /api/admin/catalog/items`
   - lista catálogo completo, inclusive não vendável

5. `POST /api/admin/catalog/import`
   - aciona importação/reimportação a partir das fontes reais do jogo

6. `PATCH /api/admin/catalog/items/:itemId`
   - altera `can_sell`, `price_brl` e curadoria futura

## Filtros mínimos da home

- `q` por nome e `item_id`
- `category`
- `required_skill`
- `min_price` e `max_price`
- `has_image=true|false`
- `sort=price_asc|price_desc|name_asc|name_desc|recent`
- `limit` e `offset` para paginação

## Campos mínimos retornados pela home

- `item_id`
- `name`
- `image_path` ou fallback
- `category`
- `status_summary`
- `price_brl`
- `can_sell` apenas em endpoint administrativo; no público pode ser implícito
- `short description` derivada de `description` ou curadoria futura

---

# Etapas

## Etapa 1 — consolidar a base SQL do marketplace em nova pasta

Resultado verificável:

- criação da pasta [`Marketplace/postgres/`](Marketplace/postgres/)
- criação de [`Marketplace/postgres/001_schema.sql`](Marketplace/postgres/001_schema.sql)
- criação de [`Marketplace/postgres/003_indexes_and_views.sql`](Marketplace/postgres/003_indexes_and_views.sql)
- atualização planejada de [`Marketplace/backend/schema.js`](Marketplace/backend/schema.js) para apontar para essa nova origem SQL

## Etapa 2 — definir o gerador do seed real do jogo

Resultado verificável:

- script de geração dentro de [`Marketplace/backend/`](Marketplace/backend/) lendo [`packages/server/data/items.json`](packages/server/data/items.json) e [`packages/client/data/sprites.json`](packages/client/data/sprites.json)
- geração determinística de [`Marketplace/postgres/002_seed_game_items.sql`](Marketplace/postgres/002_seed_game_items.sql)

## Etapa 3 — adaptar repositório e API ao schema final

Resultado verificável:

- [`Marketplace/backend/catalog.repository.js`](Marketplace/backend/catalog.repository.js) ajustado para o novo schema
- [`Marketplace/backend/server.js`](Marketplace/backend/server.js) com endpoints mínimos para home, item por id e filtros
- nenhum endpoint público lendo arquivo do jogo em tempo de requisição

## Etapa 4 — migrar o frontend para consumo exclusivo da API persistida

Resultado verificável:

- [`Marketplace/src/app/core/services/real-catalog.service.ts`](Marketplace/src/app/core/services/real-catalog.service.ts) cobrindo endpoints reais
- [`Marketplace/src/app/core/models/marketplace.models.ts`](Marketplace/src/app/core/models/marketplace.models.ts) alinhado ao contrato novo
- [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) fora da trilha principal

## Etapa 5 — expor auditoria operacional mínima

Resultado verificável:

- view de itens vendáveis
- view ou consulta de gaps de imagem
- trilha de importação registrada em tabela de execução, se incluída

---

# Riscos

- [`packages/server/data/items.json`](packages/server/data/items.json) possui estrutura heterogênea; alguns itens terão poucos atributos comerciais úteis.
- O caminho visual validado por [`packages/client/data/sprites.json`](packages/client/data/sprites.json) pode não ser diretamente servível pelo app Angular sem uma convenção adicional de assets.
- A manutenção simultânea de [`Marketplace/backend/schema.sql`](Marketplace/backend/schema.sql) e dos novos SQLs em [`Marketplace/postgres/`](Marketplace/postgres/) criaria duplicidade; a implementação deve escolher uma única fonte final.
- O catálogo atual usa nomes de campo legados como `venda`; a migração para `can_sell` exige alinhamento completo entre banco, backend e frontend.
- O checkout atual ainda referencia estruturas mockadas em [`Marketplace/src/app/core/models/marketplace.models.ts`](Marketplace/src/app/core/models/marketplace.models.ts); a mudança precisa acontecer em passos pequenos para não quebrar a UI.

---

# Observações

- O schema atual em [`Marketplace/backend/schema.sql`](Marketplace/backend/schema.sql) já serve como ponto de partida, mas o plano passa a tratar [`Marketplace/postgres/`](Marketplace/postgres/) como localização final da verdade SQL.
- O seed deve ser regenerável. O arquivo SQL final é um artefato versionado; a leitura de [`packages/server/data/items.json`](packages/server/data/items.json) não deve ocorrer na home pública.
- PIX/PixGo permanece apenas como integração futura de pedido/pagamento. O catálogo público não deve depender dessa etapa.

---

# Próximo passo implementável sem ambiguidade

O próximo passo para o modo [`Code`](Code:1) é:

1. criar a pasta [`Marketplace/postgres/`](Marketplace/postgres/)
2. criar [`Marketplace/postgres/001_schema.sql`](Marketplace/postgres/001_schema.sql) com a tabela `catalog_items`, constraints e tabela opcional `catalog_import_runs`
3. criar [`Marketplace/postgres/003_indexes_and_views.sql`](Marketplace/postgres/003_indexes_and_views.sql) com índices e a view `vw_catalog_sellable_items`
4. atualizar [`Marketplace/backend/schema.js`](Marketplace/backend/schema.js) para carregar os SQLs a partir de [`Marketplace/postgres/`](Marketplace/postgres/), removendo a dependência arquitetural de [`Marketplace/backend/schema.sql`](Marketplace/backend/schema.sql)

Esse é o menor corte implementável que prepara a base persistida correta antes de gerar o seed e antes de adaptar API e frontend.