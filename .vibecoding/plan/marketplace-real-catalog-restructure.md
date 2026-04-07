# Objetivo

Planejar a reestruturação do marketplace em [`Marketplace/`](Marketplace/) para deixar de usar catálogo mockado em [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) e passar a operar com descoberta real de produtos do jogo, preservando o isolamento operacional do marketplace e permitindo curadoria comercial por item com uma coluna booleana `venda` em banco próprio.

---

# Contexto

O requisito consolidado exige que os itens vendidos sejam baseados nos itens reais do jogo, com referência explícita ao MongoDB configurado em [`.env`](.env:63) até [`.env`](.env:72), especialmente ao banco [`acacia-game`](.env:67).

Ao mesmo tempo, o estado atual do marketplace ainda é um MVP isolado e mockado:

- o catálogo atual é hardcoded em [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts)
- o fluxo de checkout e PIX é simulado em [`Marketplace/src/app/core/services/marketplace-workflow.service.ts`](Marketplace/src/app/core/services/marketplace-workflow.service.ts)
- o runtime Docker do marketplace hoje sobe apenas um servidor estático em [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml)
- a documentação atual ainda descreve persistência mock/Mongo documental em [`Marketplace/docs/mongodb-persistence.md`](Marketplace/docs/mongodb-persistence.md)

O objetivo desta etapa é apenas definir o caminho técnico para substituir o catálogo mockado por um catálogo real e administrável.

---

# Diagnóstico do estado atual

## Marketplace atual

1. [`Marketplace/`](Marketplace/) é uma aplicação Angular isolada, fora dos workspaces principais definidos em [`package.json`](package.json).
2. O frontend atual concentra catálogo, checkout, pagamento e estado final na própria UI, principalmente em [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts).
3. Não existe backend real dentro de [`Marketplace/`](Marketplace/) para consultar banco, administrar catálogo ou persistir pedidos.
4. O Docker atual do marketplace não sobe API nem banco relacional; ele apenas serve build estático.

## Fonte real de itens no código do jogo

Pelo código atual, a definição estrutural dos itens do jogo vive principalmente em:

- [`packages/server/data/items.json`](packages/server/data/items.json)
- [`packages/server/src/game/entity/objects/item.ts`](packages/server/src/game/entity/objects/item.ts)
- [`packages/server/src/controllers/entities.ts`](packages/server/src/controllers/entities.ts)
- [`packages/common/types/item.d.ts`](packages/common/types/item.d.ts)

Esses arquivos indicam que o catálogo mestre de itens do jogo é orientado por arquivo de dados do servidor, não por coleção de catálogo dedicada já evidente no Mongo.

## Uso atual do Mongo no jogo

A camada Mongo do jogo está em:

- [`packages/common/database/mongodb/mongodb.ts`](packages/common/database/mongodb/mongodb.ts)
- [`packages/common/database/mongodb/loader.ts`](packages/common/database/mongodb/loader.ts)
- [`packages/common/database/mongodb/creator.ts`](packages/common/database/mongodb/creator.ts)

As coleções observáveis no código atual são majoritariamente voltadas a persistência de jogador e runtime, como:

- `player_info`
- `player_inventory`
- `player_bank`
- `player_equipment`
- `player_quests`
- `player_achievements`
- `player_skills`
- `player_statistics`
- `player_abilities`
- `guilds`

## Conclusão do diagnóstico

Há um descompasso entre o requisito e o estado atual:

- o marketplace vende produtos mockados que não correspondem ao jogo real
- o código do jogo sugere que a definição mestre de itens está em arquivo de dados, não em coleção de catálogo no Mongo
- o Mongo atual parece ser fonte de persistência operacional do jogo, não fonte comercial pronta para o marketplace

Isso exige uma camada explícita de catálogo comercial.

---

# Fontes reais de dados dos itens

## Fonte estrutural primária recomendada

A fonte estrutural primária deve ser tratada como:

- [`packages/server/data/items.json`](packages/server/data/items.json)

Motivo:

- é onde os itens do jogo estão definidos de forma global e estável
- é a fonte usada pelo servidor para instanciar itens reais
- representa o universo real de itens válidos do jogo

## Fonte operacional complementar

O Mongo configurado em [`.env`](.env:63) até [`.env`](.env:72) deve ser tratado como fonte complementar de observação, usando as credenciais já fornecidas para o banco [`acacia-game`](.env:67).

Uso recomendado do Mongo nesta reestruturação:

- validar conectividade com a base real do jogo
- inspecionar se existe alguma coleção adicional de item definitions não evidente no código
- consultar incidência de itens em inventários, bancos, equipamentos ou dados de jogador, se isso for útil para priorização comercial
- servir de referência operacional para entrega futura ou conciliação

## Suposição explícita

Até prova em contrário na implementação, a suposição técnica mais segura é:

- o conjunto mestre de itens do jogo vem do servidor em [`packages/server/data/items.json`](packages/server/data/items.json)
- o Mongo [`acacia-game`](.env:67) não substitui essa definição mestre, mas a complementa

Se, durante a implementação, for encontrada no Mongo uma coleção canônica de itens do jogo não refletida no código, essa descoberta deve alterar a origem primária do importador.

---

# Decisões aplicadas

- O marketplace deve continuar isolado dentro de [`Marketplace/`](Marketplace/).
- O catálogo hardcoded em [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) deve ser removido da fonte de verdade do produto.
- A descoberta de itens do jogo e a curadoria comercial devem ser separadas.
- O marketplace não deve depender de leitura direta do Mongo do jogo em tempo de renderização da vitrine pública.
- A curadoria comercial deve ocorrer em banco próprio do marketplace, preferencialmente Postgres, com uma tabela de catálogo contendo `venda boolean`.
- O Mongo do jogo deve ser consumido por integração controlada, não exposto diretamente ao frontend do marketplace.

---

# Arquitetura recomendada

## Recomendação principal

Adotar arquitetura de espelhamento para Postgres próprio do marketplace.

### Fluxo lógico recomendado

1. O marketplace possui backend próprio dentro de [`Marketplace/`](Marketplace/).
2. Esse backend executa um importador/sincronizador de itens do jogo.
3. O importador lê o universo de itens reais do jogo.
4. Os itens são gravados em Postgres do marketplace.
5. A tabela comercial mantém todos os itens conhecidos e usa `venda = true|false` para controlar exposição.
6. O frontend do marketplace consome apenas a API do marketplace.

## Por que não leitura direta do Mongo do jogo

Leitura direta do Mongo do jogo é inferior neste cenário porque:

- mistura responsabilidade comercial com persistência operacional do jogo
- dificulta curadoria por item
- aumenta acoplamento entre marketplace e banco do jogo
- expõe o catálogo público à disponibilidade e ao formato interno do Mongo do jogo
- complica evolução de preços, textos comerciais, ordenação e visibilidade
- não resolve naturalmente o requisito de `venda boolean` como estado comercial independente

## Benefícios do espelhamento para Postgres

- isolamento forte do marketplace
- catálogo público estável e próprio
- administração comercial simples
- capacidade de enriquecer dados do item sem alterar o jogo
- menor risco operacional sobre o banco do jogo
- caminho claro para painel administrativo e checkout real

---

# Organização recomendada dentro de [`Marketplace/`](Marketplace/)

## Estrutura alvo mínima

Sem mover o frontend atual de imediato, a estrutura deve evoluir conceitualmente para algo como:

- `Marketplace/src/` → frontend Angular atual
- `Marketplace/backend/` → API própria do marketplace
- `Marketplace/docker/` → compose isolado do marketplace com web, api e postgres
- `Marketplace/docs/` → contratos e documentação operacional

## Serviços do stack do marketplace

### Frontend web

Responsável por:

- listar catálogo real vindo da API
- abrir checkout
- exibir status de pagamento

### Backend marketplace

Responsável por:

- consultar Postgres
- executar import/sync de itens do jogo
- expor endpoints de catálogo público
- expor endpoints administrativos de curadoria
- persistir pedidos, pagamentos e entregas no futuro

### Postgres marketplace

Responsável por:

- catálogo comercial
- estado `venda`
- dados comerciais enriquecidos
- pedidos e pagamentos em fases posteriores

## Integração com o Mongo do jogo

O backend do marketplace deve receber as credenciais do Mongo do jogo por variáveis de ambiente derivadas das chaves já existentes em [`.env`](.env:63) até [`.env`](.env:72), sem duplicar segredo em código.

Sugestão arquitetural:

- mapear `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_DATABASE`, `MONGODB_TLS`, `MONGODB_SRV` e `MONGODB_AUTH_SOURCE` para variáveis de integração do backend do marketplace
- manter o consumo do Mongo apenas no backend/importador

---

# Modelo inicial de dados no Postgres

## Tabela principal: catálogo comercial de itens

Nome conceitual recomendado: `catalog_items`

### Campos mínimos obrigatórios

- `id`
- `game_item_key` → chave única do item no jogo
- `game_item_name` → nome original do item no jogo
- `game_item_type` → tipo técnico do item
- `source_origin` → origem do registro (`items.json`, Mongo ou híbrido)
- `venda` → booleano de controle comercial
- `price_brl` → preço comercial
- `display_name` → nome comercial exibido na loja
- `short_description` → resumo comercial
- `image_key` → chave para resolver imagem/ícone
- `stackable` → booleano derivado do item
- `max_stack` → quantidade máxima suportada
- `level_requirement` → requisito mínimo, se houver
- `skill_requirement` → skill requerida, se houver
- `sort_order` → ordenação manual
- `created_at`
- `updated_at`

### Campos úteis recomendados

- `raw_source_data` → snapshot bruto do item do jogo
- `tags` → apoio para filtros e vitrine
- `delivery_mode` → ex.: automático, manual, pendente
- `realm_scope` → caso a venda seja restrita por realm futuramente
- `last_synced_at` → última sincronização com a fonte do jogo
- `sync_hash` → detectar alterações da origem

## Regra de negócio principal

- se `venda = false`, o item não aparece no catálogo público
- se `venda = true`, o item pode aparecer no site, desde que também tenha preço e dados comerciais mínimos válidos

## Tabelas auxiliares recomendadas

### `catalog_sync_runs`

Para registrar:

- quando o sync rodou
- quantos itens foram lidos
- quantos foram criados
- quantos foram atualizados
- quantos falharam
- origem usada

### `catalog_item_audit`

Para registrar:

- mudanças de `venda`
- mudanças de preço
- alterações de nome/descrição comercial

Essas tabelas não são obrigatórias para o primeiro corte funcional, mas são recomendadas desde cedo.

---

# Estratégia de extração e sincronização

## Estratégia recomendada

Usar sincronização em duas fases.

## Fase A — descoberta do universo real de itens

Objetivo:

- listar todos os itens válidos do jogo

Fonte prioritária:

- [`packages/server/data/items.json`](packages/server/data/items.json)

Validações complementares:

- conectar ao Mongo [`acacia-game`](.env:67)
- verificar se existe coleção canônica adicional de itens
- mapear presença de itens em coleções operacionais, se necessário

Resultado esperado:

- inventário técnico completo dos itens do jogo

## Fase B — materialização no catálogo comercial

Objetivo:

- popular Postgres com todos os itens descobertos

Regras:

- todos os itens entram no Postgres
- por padrão, `venda = false`
- nenhum item aparece publicamente até ser liberado
- dados comerciais podem ser enriquecidos sem alterar o jogo

## Política de sincronização

### Carga inicial

- import completo do universo de itens

### Sincronização incremental

- reprocessar por `game_item_key`
- atualizar metadados técnicos do jogo
- preservar campos comerciais mantidos pela equipe, como `venda`, `price_brl`, `display_name` e `short_description`

## Regra crítica de sync

O sincronizador não deve sobrescrever automaticamente a curadoria comercial.

Ele deve:

- atualizar dados vindos do jogo
- manter dados comerciais quando já editados no marketplace

---

# Integração com o frontend atual

## Situação atual

O frontend depende de [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) como fonte local.

## Direção recomendada

Substituir essa dependência por uma camada de acesso a API.

## Fluxo futuro do frontend

1. o app carrega catálogo publicado via endpoint do backend
2. filtros e vitrine operam sobre dados reais retornados pela API
3. checkout usa item selecionado a partir do catálogo real
4. pagamento e entrega deixam de depender de SKU mockado arbitrário

## Regra de migração

- `catalog.data.ts` deixa de ser fonte de verdade
- pode permanecer temporariamente apenas como fallback de desenvolvimento durante transição, mas deve ser removido ao final da reestruturação

---

# Separação clara de responsabilidades

## 1. Descoberta de produtos

Responsável por:

- identificar todos os itens reais do jogo
- importar/sincronizar esses itens para o catálogo interno

Dependências:

- dados do jogo
- integração com Mongo e/ou arquivos do servidor

## 2. Administração de itens liberados para venda

Responsável por:

- marcar `venda = true|false`
- definir preço
- definir nome e descrição comercial
- controlar ordenação e visibilidade

Dependências:

- Postgres do marketplace
- API administrativa do marketplace

## 3. Checkout e pagamento PIX

Responsável por:

- receber item já curado e publicado
- iniciar pedido
- gerar cobrança PIX
- acompanhar confirmação
- acionar entrega

Dependências:

- catálogo comercial já publicado
- backend do marketplace
- integração de pagamento real
- adaptação de entrega para o jogo

Esses três fluxos não devem compartilhar a mesma fonte de estado nem a mesma responsabilidade técnica.

---

# Sequência de execução recomendada

## Etapa 1 — auditoria real das fontes de itens

Resultado verificável:

- documento/lista confirmando de onde vêm os itens reais
- confirmação se existe ou não coleção canônica de itens no Mongo `acacia-game`

## Etapa 2 — criação do backend isolado do marketplace

Resultado verificável:

- serviço backend próprio dentro de [`Marketplace/`](Marketplace/)
- API básica de health e catálogo

## Etapa 3 — provisionamento do Postgres do marketplace

Resultado verificável:

- banco próprio do marketplace subindo via Docker isolado em [`Marketplace/docker/`](Marketplace/docker/)
- schema inicial do catálogo criado

## Etapa 4 — implementação do importador inicial

Resultado verificável:

- rotina que lista todos os itens reais do jogo
- carga inicial no Postgres com `venda = false`

## Etapa 5 — administração de liberação comercial

Resultado verificável:

- mecanismo para marcar itens vendáveis
- itens publicados apenas quando `venda = true`

## Etapa 6 — substituição do catálogo hardcoded no frontend

Resultado verificável:

- frontend consumindo endpoint real do catálogo
- [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts) fora da trilha principal

## Etapa 7 — preparação de checkout real

Resultado verificável:

- pedido referenciando item real do catálogo comercial
- eliminação de dependência em SKU mockado sem lastro no jogo

## Etapa 8 — integração futura de entrega e pagamento real

Resultado verificável:

- contrato claro entre pedido pago e concessão do item no jogo
- trilha segura para PIX real e entrega real

---

# Passos práticos que serão necessários depois

## Para listar todos os itens reais

- inspecionar [`packages/server/data/items.json`](packages/server/data/items.json)
- conectar no Mongo [`acacia-game`](.env:67) com as credenciais de [`.env`](.env:63)
- confirmar se existe coleção adicional de item definitions
- gerar inventário técnico consolidado por `game_item_key`

## Para popular o Postgres inicial

- transformar cada item descoberto em registro de `catalog_items`
- copiar atributos técnicos mínimos
- inicializar `venda = false`
- registrar origem e timestamp do sync

## Para marcar itens vendáveis

- criar fluxo administrativo simples
- liberar somente itens com preço e apresentação comercial preenchidos
- ativar `venda = true` item a item

## Para alimentar o frontend com catálogo real

- expor endpoint público apenas com itens `venda = true`
- adaptar o frontend para buscar catálogo via HTTP
- alinhar os modelos atuais do frontend aos campos reais retornados pela API

---

# Riscos

## Risco 1 — supor que o Mongo já contém catálogo mestre

O código atual não comprova isso. Se a implementação assumir essa estrutura sem validação, o importador pode nascer errado.

## Risco 2 — sobrescrever curadoria comercial durante sync

Se o importador reescrever `venda`, preço ou descrição, a operação da loja ficará instável.

## Risco 3 — acoplamento excessivo ao banco do jogo

Ler o banco do jogo diretamente em tempo de requisição pública aumentará fragilidade e impacto operacional.

## Risco 4 — manter o frontend preso ao modelo mock atual

Os tipos em [`Marketplace/src/app/core/models/marketplace.models.ts`](Marketplace/src/app/core/models/marketplace.models.ts) refletem o MVP atual e precisarão ser realinhados ao catálogo real.

## Risco 5 — ausência inicial de campos comerciais no jogo

Os itens do jogo provavelmente não possuem preço em BRL, descrição comercial curta, ordenação de vitrine ou tags de marketing. Esses dados terão de nascer no Postgres do marketplace.

---

# Dependências

- acesso válido ao Mongo configurado em [`.env`](.env:63) até [`.env`](.env:72)
- confirmação da estrutura real do banco [`acacia-game`](.env:67)
- definição do stack do backend do marketplace
- provisionamento de Postgres isolado dentro de [`Marketplace/`](Marketplace/)
- definição mínima de contrato entre catálogo, checkout e entrega

---

# Decisões necessárias antes da implementação

## Decisão 1

Confirmar se o Mongo `acacia-game` possui alguma coleção canônica de itens além da fonte observada no código.

## Decisão 2

Definir qual stack será usada para o backend isolado em [`Marketplace/`](Marketplace/).

## Decisão 3

Definir como serão gerenciados os dados comerciais obrigatórios ausentes no jogo, como:

- preço
n- nome comercial alternativo
- descrição curta
- imagem
- ordem de vitrine

## Decisão 4

Definir se `venda` será global ou se poderá variar por realm no futuro.

## Decisão 5

Definir se a primeira administração comercial será:

- via banco/manual seed
- via endpoint administrativo simples
- via painel administrativo dedicado

---

# Observações

- A recomendação principal deste plano é usar o jogo como fonte de descoberta de itens e o Postgres do marketplace como fonte de publicação comercial.
- Isso atende simultaneamente ao requisito de catálogo real e ao requisito de curadoria com `venda boolean`.
- O marketplace permanece isolado em [`Marketplace/`](Marketplace/), sem depender de catálogo hardcoded e sem acoplar a vitrine pública ao Mongo operacional do jogo.
- Durante a implementação, a primeira validação crítica deve ser provar de onde vem o universo mestre de itens: código do jogo, Mongo ou ambos.
