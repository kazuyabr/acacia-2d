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

Pelo objetivo descrito, o modelo mais coerente não é escalar “um container já ativo”, e sim escalar o serviço [`world`](packages/server/package.json) **horizontalmente**, criando **novos containers a partir da mesma imagem**.

Ou seja:

- 1 imagem base de world
- N instâncias/containers dessa imagem
- cada instância sobe com metadados próprios
- o [`hub`](packages/hub/package.json) descobre essas instâncias automaticamente

### Regra operacional

- não aumentar capacidade “dentro” de um container ativo
- criar novos containers quando precisar de mais capacidade
- remover containers quando a capacidade extra não for mais necessária
- tratar single world como apenas 1 instância registrada

### Motivos

- facilita auto-scaling real em cloud
- reduz acoplamento operacional
- evita necessidade de editar [`nginx`](docker-multiworld/nginx/nginx.conf) a cada novo world
- permite subida manual ou automática de novos worlds sem reinício global
- aproxima a arquitetura de ambientes como Azure Container Apps, AKS ou ECS/Kubernetes

---

## Como o serviço `world` deve escalar

### Conceito correto

Um `world` escalável não é um processo “maior” dentro de um container existente.

Ele deve ser tratado como:

- **channel** quando o objetivo for aumentar capacidade do mesmo servidor lógico
- **realm** quando o objetivo for lançar um servidor distinto com identidade própria

### Escala horizontal de channels

Use quando quiser suportar mais jogadores do mesmo ambiente lógico.

Exemplo:

- `world-kind=channel`
- `realmId=season-1`
- `channelId=1`, `channelId=2`, `channelId=3`

Cada novo container:

1. sobe com a mesma imagem
2. recebe `WORLD_KIND=channel`
3. recebe `REALM_ID` e `CHANNEL_ID`
4. registra-se no hub
5. aparece automaticamente na lista pública

### Criação deliberada de realms

Use quando quiser “novo servidor” no sentido clássico de MMORPG.

Exemplo:

- `world-kind=realm`
- `realmId=global-1`
- `realmId=global-2`
- `realmId=season-fresh-2026`

Cada realm pode ter:

- nome próprio
- ranking próprio
- economia própria
- guildas próprias
- regras/eventos próprios

---

## Estratégia híbrida recomendada

A melhor estratégia inicial é híbrida, mas com **modelo operacional centrado em banco compartilhado**.

### Banco central compartilhado para

- contas
- autenticação
- personagens base
- social/amigos
- guildas globais, se o produto exigir
- catálogo/configuração
- registry do hub
- metadados de realms/channels

### Estado separado por runtime para

- presença online
- filas
- lotação
- sessões efêmeras
- métricas de runtime
- heartbeat/health

### Isolamento opcional por realm

Quando houver necessidade de “novo servidor do zero”, o isolamento deve ser aplicado **por realm**, não por todo channel.

As opções de isolamento por realm são:

- coleções separadas no mesmo MongoDB
- database lógico separado no mesmo cluster MongoDB
- cluster separado apenas para realms premium/sazonais

### Recomendação prática

Começar com:

- **um cluster MongoDB principal compartilhado**
- **isolamento lógico por `realmId`**
- **channels compartilhados dentro do realm**

Isso entrega:

- simplicidade inicial
- escalabilidade horizontal
- possibilidade futura de realms isolados sem refazer tudo

---

## Banco compartilhado vs banco separado

### Melhor escolha inicial

Para o estágio atual do projeto, a melhor escolha é:

- **banco compartilhado como padrão**
- **isolamento lógico por `realmId`**
- **channels como unidade de escala horizontal**

### Por que não começar com banco por world

Banco por world desde o início complica:

- deploy
- migração
- observabilidade
- backup
- analytics
- automação de novos worlds

Além disso, se cada novo world exigir um banco novo, o auto-scaling fica pesado demais para um projeto que quer crescer com simplicidade.

### Quando usar banco realmente separado

Só vale a pena quando um `realm` precisar de:

- economia totalmente isolada
- progressão separada
- reset sazonal completo
- governança operacional separada
- retenção/regra específica por região ou publisher

---

## Channels vs servidores distintos

### Melhor resposta

A melhor abordagem não é escolher apenas um dos dois.

O sistema deve suportar os dois papéis:

- **channel** = escala de capacidade
- **realm** = escala de produto

### Channel

Use `channel` para:

- distribuir população
- reduzir lotação
- escalar automaticamente
- manter identidade compartilhada do jogador dentro do mesmo realm

Capacidade recomendada inicialmente:

- alvo operacional de **150 a 200 jogadores por channel**
- limite superior de segurança entre **200 e 250**, dependendo de CPU, memória e tráfego websocket

### Realm

Use `realm` para:

- lançar novos servidores
- criar corrida nova por top guilds
- criar economia nova
- fazer temporadas/reset competitivo
- permitir novos domínios de progressão

Essa é a parte que se alinha ao padrão moderno de MMORPG citado pelo usuário: novos servidores periódicos como estratégia de retenção e competição.

---

## Modelo recomendado para Azure

A melhor direção para cloud não é depender de um único [`docker-compose.yml`](docker-multiworld/docker-compose.yml) como forma final de operação.

### Recomendação de plataforma

#### Fase inicial

Usar:

- Azure Container Apps para [`client`](packages/client/package.json), [`hub`](packages/hub/package.json) e `worlds`
- Azure Database for MongoDB ou MongoDB Atlas
- Azure Container Registry para armazenar imagens
- GitHub Actions para build e deploy

#### Fase de crescimento

Evoluir para:

- AKS/Kubernetes, se houver necessidade forte de orquestração avançada
- HPA/KEDA para auto-scaling baseado em CPU, memória, fila ou métrica customizada

### Por que Azure Container Apps primeiro

Porque entrega mais rápido:

- scale out manual simples
- scale out automático simples
- revisão por imagem/tag
- secrets gerenciados
- menor custo operacional que Kubernetes no começo

---

## Serviços externos recomendados

Faz sentido tratar alguns serviços como externos à malha principal de runtime.

### Recomendação

Manter externos:

- `nginx` ou gateway público
- `mongodb`

Manter como runtime da aplicação:

- [`hub`](packages/hub/package.json)
- [`client`](packages/client/package.json)
- `world-*`

### Motivos para externalizar `mongodb`

- é infraestrutura de dados, não runtime de jogo
- facilita backup, observabilidade, tuning e alta disponibilidade
- reduz acoplamento entre deploy da aplicação e operação do banco
- combina melhor com Azure Database for MongoDB ou MongoDB Atlas

### Motivos para externalizar `nginx`

- é camada de entrada/gateway, não lógica de domínio
- facilita troca futura por ingress gerenciado, load balancer ou API gateway
- evita prender o desenho da plataforma ao compose atual
- simplifica evolução para Azure Front Door, Application Gateway ou ingress controller

### Observação importante sobre `nginx`

Em cloud, a melhor direção costuma ser não depender obrigatoriamente de um `nginx` próprio para sempre.

A ordem de preferência arquitetural tende a ser:

1. gateway gerenciado da plataforma
2. ingress controller ou gateway dedicado
3. `nginx` em container apenas enquanto simplifica a fase inicial

### Conclusão prática

Para o cenário atual:

- **`mongodb` deve ser externo desde cedo**
- **`nginx` pode começar como container, mas o ideal é evoluir para gateway gerenciado**
- **[`hub`](packages/hub/package.json), [`client`](packages/client/package.json) e `worlds` continuam sendo as unidades principais de deploy e escala**

---

## Escala manual e automática

### Escala manual

Fluxo recomendado:

1. publicar imagem nova no registry
2. subir nova revisão/instância de `world`
3. definir `WORLD_KIND`, `REALM_ID`, `CHANNEL_ID`, `CAPACITY`, `VERSION`
4. world registra-se no hub
5. hub publica automaticamente

### Escala automática

Fluxo recomendado para channels:

1. monitorar lotação por channel
2. quando atingir limiar, criar nova instância do mesmo tipo
3. nova instância entra com novo `CHANNEL_ID`
4. hub passa a listá-la
5. balanceamento de entrada direciona novos jogadores ao channel menos lotado

### Regra importante

Auto-scaling deve ser usado para **channels**, não para criar `realms` competitivos automaticamente.

`realm` novo deve ser decisão de produto/negócio.

---

## Papel do hub no modelo escalável

O hub deve deixar de ser apenas lista simples de servidores e passar a ser um **registry central de runtime**.

Ele deve conhecer pelo menos:

- `worldId`
- `worldKind` (`channel` ou `realm`)
- `realmId`
- `channelId`
- `host`
- `wsPort`
- `apiPort`
- `capacity`
- `population`
- `version`
- `region`
- `status`
- `lastHeartbeatAt`

### Comportamento esperado

- se uma instância nova subir, ela aparece automaticamente
- se uma instância cair, expira por TTL
- se a versão estiver incompatível, o hub pode ocultar ou marcar indisponível
- o client nunca depende de lista fixa embutida

---

## Automação com GitHub Actions

### Papel do pipeline

O pipeline deve automatizar:

- build da imagem
- push para registry
- deploy do hub
- deploy do client
- deploy de templates de world

### Estratégia recomendada

Separar o pipeline em dois tipos:

#### Pipeline de plataforma

Responsável por:

- hub
- client
- nginx/gateway
- infraestrutura base

#### Pipeline de runtime de world

Responsável por:

- publicar imagem padrão de world
- permitir deploy manual de novo `realm`
- permitir ajuste de réplicas para `channels`

### Benefício

Isso permite:

- escalar manualmente quando quiser lançar novo servidor
- escalar automaticamente channels de capacidade
- manter rastreabilidade por ambiente, imagem e revisão

---

## Estratégia de adoção sem quebrar os ambientes atuais

Como o objetivo é testar essa abordagem usando [`.env.scalable`](.env.scalable) e [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml), a recomendação é tratar esse ambiente como **trilha paralela de validação**, sem alterar o comportamento já funcional de [`.env.defaults`](.env.defaults), [`.env.multiworld`](.env.multiworld), [`docker/docker-compose.yml`](docker/docker-compose.yml) e [`docker-multiworld/docker-compose.yml`](docker-multiworld/docker-compose.yml).

### Regra de compatibilidade

- não reaproveitar [`.env.multiworld`](.env.multiworld) dentro de [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml)
- não apontar [`docker-multiworld-scalable/Dockerfile`](docker-multiworld-scalable/Dockerfile) para arquivos de [`docker-multiworld/`](docker-multiworld/)
- não alterar contratos dos ambientes existentes durante a fase de teste
- isolar portas, nomes de serviço, volumes e variáveis do ambiente escalável quando necessário

### Problema observado no estado atual

O ambiente [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml) ainda está espelhando o ambiente antigo:

- usa [`docker-multiworld/Dockerfile`](docker-multiworld/Dockerfile:5) em vez de [`docker-multiworld-scalable/Dockerfile`](docker-multiworld-scalable/Dockerfile:1)
- usa [`.env.multiworld`](.env.multiworld:1) em vez de [`.env.scalable`](.env.scalable:1)
- monta [`.env.multiworld`](.env.multiworld:1) como `/app/.env`
- ainda descreve worlds fixos (`world-1`, `world-2`) como no ambiente multiworld atual

Portanto, hoje ele ainda não é um ambiente escalável isolado de verdade, apenas uma cópia estrutural do ambiente [`docker-multiworld/`](docker-multiworld/).

### Status correto de [`docker-multiworld-scalable/`](docker-multiworld-scalable/)

[`docker-multiworld-scalable/`](docker-multiworld-scalable/) **não deve ser tratado como implementação pronta**.

Neste momento, ele deve ser entendido como:

- uma **cópia inicial de referência** de [`docker-multiworld/`](docker-multiworld/)
- uma **área de experimentação arquitetural**
- o local onde a abordagem de **isolamento e escalabilidade** será aplicada progressivamente

Consequências práticas:

- arquivos atuais podem ser **alterados**, **substituídos** ou **excluídos** conforme a necessidade
- a estrutura da pasta não precisa permanecer idêntica à de [`docker-multiworld/`](docker-multiworld/)
- a pasta pode evoluir para conter **subpastas específicas por serviço**
- a pasta pode conter **mais de um [`docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml)** ou **mais de um [`Dockerfile`](docker-multiworld-scalable/Dockerfile)**, desde que isso ajude no isolamento operacional

### Diretriz específica para nginx

As configurações de `nginx` dentro de [`docker-multiworld-scalable/nginx/`](docker-multiworld-scalable/nginx/) também fazem parte da trilha experimental.

Portanto:

- elas devem ser revistas para o modelo isolado
- podem deixar de espelhar [`docker-multiworld/nginx/nginx.conf`](docker-multiworld/nginx/nginx.conf)
- devem ser empacotadas e inseridas no container/gateway correspondente ao desenho final do ambiente escalável
- podem ser reorganizadas em arquivos e subpastas adicionais se isso melhorar a separação entre gateway, client público e rotas internas

### Diretriz para o experimento escalável

O ambiente escalável deve ser tratado como:

- **novo stack experimental**
- **mesmo código-fonte da aplicação**
- **configuração isolada**
- **topologia própria de deploy**

### O que deve permanecer estável

Devem continuar funcionais e inalterados:

- [`.env.defaults`](.env.defaults)
- [`.env.multiworld`](.env.multiworld)
- [`docker/docker-compose.yml`](docker/docker-compose.yml)
- [`docker-multiworld/docker-compose.yml`](docker-multiworld/docker-compose.yml)
- [`docker-multiworld/nginx/nginx.conf`](docker-multiworld/nginx/nginx.conf)

### O que o stack escalável deve validar

O ambiente [`docker-multiworld-scalable/`](docker-multiworld-scalable/) deve provar separadamente:

- uso exclusivo de [`.env.scalable`](.env.scalable)
- separação clara entre runtime principal e infraestrutura externa
- possibilidade de subir `hub`, `client` e `world` de forma independente
- capacidade de adicionar novos worlds sem editar a lista fixa do client
- compatibilidade futura com Azure Container Apps e pipeline de deploy

---

## Recomendação final objetiva

### Melhor arquitetura para o cenário atual

Usar:

- **multiworld como arquitetura base**
- **single world como caso especial de 1 instância**
- **containers separados por serviço**
- **uma imagem padrão para `world` com múltiplas instâncias**
- **hub com self-registration + heartbeat + TTL**
- **banco compartilhado como padrão operacional**
- **isolamento lógico por `realmId`**
- **channels para auto-scaling de capacidade**
- **realms para novos servidores competitivos/sazonais**
- **Azure Container Apps como primeira plataforma cloud**
- **GitHub Actions para build/deploy e scale workflows**
- **stack escalável isolado em [`docker-multiworld-scalable/`](docker-multiworld-scalable/) usando [`.env.scalable`](.env.scalable)**

### Interpretação prática

- quer mais capacidade: sobe mais `channels`
- quer novo servidor do zero: cria novo `realm`
- quer simplicidade operacional: mantém banco compartilhado com isolamento lógico
- quer isolamento forte futuro: promove apenas alguns realms para banco/cluster separado
- quer experimentar sem risco: valida tudo primeiro no stack [`docker-multiworld-scalable/`](docker-multiworld-scalable/)

Essa abordagem entrega a melhor relação entre simplicidade inicial, escalabilidade automática, controle manual de novos servidores, preservação dos ambientes atuais e compatibilidade com crescimento futuro em cloud.
