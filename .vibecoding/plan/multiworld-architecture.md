# Arquitetura recomendada para single world e multiworld

## Contexto

Hoje o modo single world em [`docker/docker-compose.yml`](docker/docker-compose.yml) ainda concentra cliente, servidor e hub no serviço [`client-server`](docker/docker-compose.yml:2). Já o modo multiworld em [`docker-multiworld/docker-compose.yml`](docker-multiworld/docker-compose.yml) está mais próximo de uma arquitetura escalável, com [`hub`](docker-multiworld/docker-compose.yml:2), [`world-1`](docker-multiworld/docker-compose.yml:29), [`world-2`](docker-multiworld/docker-compose.yml:64), [`client`](docker-multiworld/docker-compose.yml:99), [`nginx`](docker-multiworld/docker-compose.yml:127) e [`mongo`](docker-multiworld/docker-compose.yml:140) em containers separados.

A direção arquitetural mais consistente é tratar o multiworld como padrão estrutural e o single world apenas como um caso especial com um único world registrado no hub.

---

## Objetivo

Permitir que:

- cada serviço rode em seu próprio container
- novos worlds possam ser iniciados dinamicamente
- o hub descubra e publique worlds ativos sem reconfiguração manual do client
- o sistema escale de forma previsível
- single world e multiworld compartilhem a mesma base arquitetural

---

## Estrutura de containers recomendada

### Serviços principais

- `hub`
- `client`
- `nginx`
- `world-*` (um container por world)
- `mongo-auth-meta`
- `mongo-world-*` opcional, caso haja isolamento por world

### Responsabilidades

#### [`hub`](packages/hub/package.json)

Responsável por:

- registrar worlds ativos
- manter lista pública de worlds/canais
- receber heartbeats
- marcar worlds online/offline
- expor API de descoberta para o client

#### [`world`](packages/server/package.json)

Responsável por:

- executar a lógica de runtime de um mundo/canal
- expor websocket e API local
- registrar-se no hub ao subir
- enviar heartbeat periódico

#### [`client`](packages/client/package.json)

Responsável por:

- consultar o hub
- obter a lista atualizada de worlds
- conectar-se ao world selecionado

#### [`nginx`](docker-multiworld/nginx/nginx.conf)

Responsável por:

- servir o client
- rotear requests para hub/client
- manter a entrada pública única

#### `mongo-auth-meta`

Responsável por:

- contas
- autenticação
- metadados do hub
- lista persistida de worlds
- configuração compartilhada

#### `mongo-world-*` opcional

Responsável por:

- persistência isolada de cada world, se o produto exigir realms independentes

---

## Como separar corretamente os serviços

A separação ideal é:

- 1 container para o hub
- 1 container para o client
- 1 container para o nginx
- 1 container por world
- 1 container de banco central
- opcionalmente 1 banco por world

Isso evita o acoplamento operacional do modelo atual em [`client-server`](docker/docker-compose.yml:2) e transforma o single world em apenas uma composição reduzida do mesmo padrão.

### Regra prática

- single world = hub + client + nginx + 1 world + banco
- multiworld = hub + client + nginx + N worlds + banco

---

## Descoberta dinâmica de worlds pelo hub

A estratégia recomendada é **self-registration com heartbeat**.

### Fluxo

1. O container do world sobe.
2. O world se conecta ao hub usando token interno.
3. O world envia seus metadados.
4. O hub registra esse world como disponível.
5. O world envia heartbeat em intervalo fixo.
6. Se o heartbeat expirar, o hub marca o world como offline.
7. O client consulta o hub para obter a lista atualizada.

### Metadados mínimos enviados pelo world

- `serverId`
- `name`
- `type` (`world` ou `channel`)
- `host`
- `wsPort`
- `apiPort`
- `capacity`
- `region`
- `status`
- `version`

### Estado mantido pelo hub

O hub deve manter pelo menos:

- registry de worlds ativos
- timestamp do último heartbeat
- capacidade e ocupação
- status online/offline

### Onde armazenar esse registry

#### Opção simples

- memória + heartbeat

Vantagem:
- simples de implementar

Desvantagem:
- perde o estado se o hub reiniciar

#### Opção mais robusta

- MongoDB ou Redis com TTL

Vantagem:
- permite recuperar estado
- facilita múltiplas instâncias do hub
- melhora operação em escala

Desvantagem:
- adiciona complexidade operacional

### Recomendação

Para produção com crescimento, o melhor caminho é:

- self-registration
- heartbeat com TTL
- registry persistido ou cacheado fora da memória local do processo
- client consultando o hub, nunca uma lista fixa no front-end

---

## Estratégia de roteamento

O [`nginx`](docker-multiworld/nginx/nginx.conf) não deve conhecer manualmente todos os worlds para fins de descoberta lógica. O ideal é:

- `nginx` expõe a entrada pública única
- `hub` informa ao client quais worlds estão ativos
- `client` conecta no world selecionado com base na resposta do hub

Isso reduz manutenção manual quando novos worlds são criados.

---

## Banco por world vs banco compartilhado

Há duas arquiteturas possíveis.

## Opção 1: banco isolado por world

### Modelo

Cada world possui sua própria base de dados. O progresso dos jogadores, economia, inventário e estado persistido ficam separados por mundo.

### Vantagens

- isolamento forte entre worlds
- falha lógica ou corrupção em um world não afeta os demais
- manutenção por world fica mais simples
- combina com MMORPG clássico baseado em realms independentes
- políticas e eventos por world ficam mais fáceis de isolar

### Desvantagens

- maior custo operacional
- migrações precisam ser aplicadas em vários bancos
- ranking global e analytics ficam mais complexos
- transferência entre worlds exige projeto próprio
- adicionar muitos worlds aumenta bastante a complexidade

### Quando faz sentido

Esse modelo faz sentido quando:

- cada world é um realm independente
- jogadores têm identidade separada por world
- economias e progressão são isoladas
- mudança de world não é um fluxo comum do produto

---

## Opção 2: banco compartilhado com worlds como canais

### Modelo

Todos os worlds/channels usam a mesma base. O world passa a representar capacidade, shard ou canal de execução, e não um realm isolado.

### Vantagens

- escala melhor horizontalmente
- adicionar/remover canais é mais simples
- operação e observabilidade ficam mais fáceis
- ranking global, guilda, amigos e analytics ficam mais naturais
- reduz atrito para o jogador
- combina com descoberta dinâmica e auto-scaling

### Desvantagens

- exige cuidado maior com concorrência
- sessões e presença precisam ser bem modeladas
- falhas em dados compartilhados impactam todos os canais
- isolamento econômico e social entre worlds fica menor

### Quando faz sentido

Esse modelo faz sentido quando:

- worlds são canais de capacidade
- o jogador troca de canal para encontrar outros jogadores
- o objetivo principal é escalar população
- a identidade do personagem é global

---

## Recomendação arquitetural para este cenário

Pelo objetivo descrito, o modelo mais coerente é:

- containers separados por serviço
- hub central com descoberta dinâmica
- worlds tratados como canais
- banco compartilhado para contas e progresso
- estado de sessão/presença por world ou canal

### Motivos

- facilita subir e remover worlds dinamicamente
- reduz reconfiguração manual
- mantém uma única identidade de personagem
- melhora escalabilidade operacional
- simplifica integração com hub

---

## Estratégia híbrida recomendada

A melhor estratégia inicial tende a ser híbrida:

### Banco central compartilhado para

- contas
- autenticação
- personagens
- social/guilda/amigos
- catálogo/configuração
- registry do hub

### Estado separado por world/channel para

- presença online
- filas
- lotação
- sessões efêmeras
- métricas de runtime

### Evolução futura possível

Se surgir necessidade de realms realmente independentes, o sistema pode evoluir para:

- banco por world apenas para progressão/economia específicas
- hub mantendo descoberta central
- auth ainda centralizado

Assim, o sistema começa simples sem impedir futura segmentação forte.

---

## Recomendação final objetiva

### Se o objetivo principal for escalabilidade

Usar:

- hub central
- worlds como canais
- banco compartilhado
- containers separados
- descoberta dinâmica com heartbeat

### Se o objetivo principal for isolamento de produto

Usar:

- hub central
- um banco por world
- containers separados
- descoberta dinâmica com metadados de realm

### Melhor escolha para o cenário atual

Para o cenário descrito, a melhor escolha é:

- **multiworld como arquitetura base**
- **single world como caso especial de 1 world**
- **containers separados por serviço**
- **hub com self-registration + heartbeat**
- **banco compartilhado com worlds como canais**

Essa abordagem entrega a melhor relação entre simplicidade operacional, escalabilidade e capacidade de expansão futura.
