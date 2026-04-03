# Objetivo

Definir a aplicação do modelo multiworld escalável em uma trilha isolada baseada em [`.env.scalable`](.env.scalable), usando [`docker-multiworld-scalable/`](docker-multiworld-scalable/) como área de evolução controlada, sem quebrar [`.env.defaults`](.env.defaults), [`.env.multiworld`](.env.multiworld), [`docker/`](docker/), nem [`docker-multiworld/`](docker-multiworld/).

Também definir como essa mesma arquitetura deve evoluir para deploy por GitHub Actions em Azure e, se necessário, para operação sob Kubernetes.

---

# Contexto

O projeto já possui:

- um ambiente single world em [`docker/docker-compose.yml`](docker/docker-compose.yml)
- um ambiente multiworld tradicional em [`docker-multiworld/docker-compose.yml`](docker-multiworld/docker-compose.yml)
- um ambiente experimental em [`docker-multiworld-scalable/`](docker-multiworld-scalable/)
- uma configuração dedicada em [`.env.scalable`](.env.scalable)

O diretório [`docker-multiworld-scalable/`](docker-multiworld-scalable/) ainda não representa uma implementação final. Ele deve ser tratado como espaço de transição para a arquitetura escalável, podendo sofrer reorganização estrutural, substituição de arquivos, criação de subpastas por serviço e múltiplos manifests Docker.

---

# Decisões aplicadas

- O stack escalável deve ser isolado dos ambientes já existentes.
- [`docker-multiworld-scalable/`](docker-multiworld-scalable/) é trilha paralela de implantação, não substituição imediata.
- O serviço `world` deve escalar horizontalmente por novas instâncias, e não por aumento interno de um container já ativo.
- O banco deve ser compartilhado como padrão operacional inicial, com isolamento lógico por `realmId`.
- `channel` é unidade de capacidade.
- `realm` é unidade de produto.
- `mongodb` deve ser tratado como serviço externo desde cedo.
- `nginx` pode existir inicialmente no stack Docker local, mas a arquitetura deve permitir futura troca por gateway gerenciado.
- A arquitetura deve ser compatível com Docker local, Azure e Kubernetes.

---

# Estratégia

A estratégia será aplicada em 3 camadas compatíveis entre si.

## 1. Camada local de validação com Docker

Usar [`docker-multiworld-scalable/`](docker-multiworld-scalable/) para provar localmente que:

- `hub`, `client` e `world` podem subir separadamente
- o stack usa exclusivamente [`.env.scalable`](.env.scalable)
- novos worlds podem ser adicionados sem alterar o client manualmente
- o hub mantém registry dinâmico com heartbeat
- as rotas públicas funcionam por gateway isolado

## 2. Camada de entrega com GitHub Actions

Automatizar:

- build de imagens
- versionamento por tag ou SHA
- push para registry
- deploy separado de `hub`, `client` e `world-template`
- workflows específicos para scale manual de channels
- workflows específicos para criação manual de realms

## 3. Camada de execução em cloud

Projetar a topologia para rodar primeiro em Azure com baixa fricção operacional e depois permitir evolução para Kubernetes sem refazer o modelo lógico.

---

# Estrutura alvo para [`docker-multiworld-scalable/`](docker-multiworld-scalable/)

A pasta não deve permanecer como simples cópia plana de [`docker-multiworld/`](docker-multiworld/). O alvo é uma estrutura orientada por serviço.

## Estrutura conceitual recomendada

- `gateway/`
- `hub/`
- `client/`
- `world/`
- `compose/`
- `shared/`
- `docs/` opcional

## Diretriz de manifests

A pasta pode conter:

- um compose base para dependências locais
- um compose para stack mínimo
- um compose para scale local
- Dockerfiles separados por serviço, se necessário
- assets e configs próprias de gateway

## Regra de isolamento

Nada em [`docker-multiworld-scalable/`](docker-multiworld-scalable/) deve depender operacionalmente de [`.env.multiworld`](.env.multiworld) ou de arquivos de [`docker-multiworld/`](docker-multiworld/), exceto como referência histórica temporária durante a migração.

---

# Topologia alvo do stack escalável

## Serviços internos de runtime

- `hub`
- `client`
- `world`

## Serviços externos ou externalizáveis

- `mongodb`
- `gateway público` (`nginx` inicialmente, gateway gerenciado depois)

## Responsabilidades

### `hub`

- registry central de runtime
- descoberta dinâmica de worlds
- heartbeat e TTL
- catálogo de realms/channels
- filtro por versão compatível

### `client`

- consulta o hub
- obtém lista atualizada de destinos
- mostra realms/channels disponíveis
- conecta no destino selecionado

### `world`

- executa runtime de jogo
- anuncia capacidade e ocupação
- registra `realmId`, `channelId` e tipo
- expõe websocket e API local

### `gateway`

- entrega do client web
- proxy para hub HTTP
- roteamento público de websocket
- futura substituição por serviço gerenciado compatível

---

# Modelo de escalabilidade

## Unidade de escala

O serviço `world` deve usar uma imagem padrão única e gerar múltiplas instâncias.

Cada instância deve subir com metadados como:

- `WORLD_KIND`
- `REALM_ID`
- `CHANNEL_ID`
- `SERVER_ID`
- `CAPACITY`
- `VERSION`
- `REGION`

## Channel

Usar `channel` para:

- distribuir população
- aumentar capacidade do mesmo realm
- permitir scale manual e automático

Faixa inicial recomendada:

- alvo: 150 a 200 jogadores por channel
- teto operacional a validar: 200 a 250

## Realm

Usar `realm` para:

- lançar servidor novo
- criar economia separada
- abrir nova corrida por ranking e guildas
- fazer temporadas ou fresh start

## Regra principal

- scale automático atua em `channels`
- criação de `realms` é decisão manual de produto

---

# Estratégia de dados

## Escolha inicial

Usar banco compartilhado com isolamento lógico por `realmId`.

## Compartilhado no início

- contas
- autenticação
- personagens base
- social
- catálogo e configuração
- registry do hub

## Efêmero por instância

- presença
- sessões
- heartbeat
- fila
- lotação
- métricas de runtime

## Evolução futura

Se um realm precisar de isolamento forte, ele pode migrar para:

- coleções próprias
- database lógico próprio
- cluster próprio

Sem alterar a lógica central de descoberta do hub.

---

# Plano de aplicação no Docker local

## Etapa 1 — isolar o stack experimental

Resultado verificável:

- [`docker-multiworld-scalable/`](docker-multiworld-scalable/) usa apenas [`.env.scalable`](.env.scalable)
- nenhuma referência operacional obrigatória sobra para [`docker-multiworld/`](docker-multiworld/)

Ações planejadas:

- trocar referências de env file
- trocar mounts de `.env`
- trocar referências cruzadas de Dockerfile
- separar configs de gateway do stack experimental

## Etapa 2 — separar manifests por papel

Resultado verificável:

- existe uma composição mínima local previsível
- existe caminho explícito para subir stack base e stack com worlds extras

Ações planejadas:

- definir compose base
- definir compose de scale local
- permitir adicionar novo world com parâmetros isolados

## Etapa 3 — formalizar registry dinâmico

Resultado verificável:

- novo world aparece automaticamente na lista
- remoção de world expira por TTL

Ações planejadas:

- documentar contrato de registro
- documentar heartbeat
- documentar shape mínimo de metadados de world

## Etapa 4 — preparar gateway do ambiente escalável

Resultado verificável:

- client e hub ficam acessíveis pela entrada pública definida
- gateway do stack experimental tem configuração própria

Ações planejadas:

- revisar configs em [`docker-multiworld-scalable/nginx/`](docker-multiworld-scalable/nginx/)
- separar rotas públicas de client, hub e websocket
- manter compatibilidade com futura troca por gateway gerenciado

---

# Estratégia de deploy com GitHub Actions

## Objetivo

Garantir que o mesmo modelo local possa ser promovido para Azure sem acoplamento a deploy manual.

## Pipelines recomendados

### Pipeline de plataforma

Responsável por:

- build e push do `client`
- build e push do `hub`
- build e push do gateway, se ele continuar containerizado
- atualização da infraestrutura base

### Pipeline de runtime

Responsável por:

- build e push da imagem padrão de `world`
- deploy manual de novo `realm`
- scale manual de `channels`
- atualização controlada da versão de `world`

## Entradas mínimas dos workflows

- ambiente
- imagem/tag
- realm alvo
- quantidade de réplicas
- region
- flags de rollout

## Resultado esperado

Depois de pronto, o deploy deixa de depender de edição manual de compose em produção.

---

# Estratégia para Azure

## Fase recomendada inicial

Usar:

- Azure Container Registry
- Azure Container Apps para `hub`, `client` e `world`
- MongoDB gerenciado externo
- gateway público externo ou containerizado conforme maturidade da plataforma

## Motivo

Esse desenho oferece:

- menor esforço operacional inicial
- scale manual simples
- base para auto-scaling
- revisão por imagem/versionamento
- caminho de migração mais simples para Kubernetes

## Modelo operacional em Azure

### `hub`

- 1 app com escala controlada
- exposto internamente ou publicamente conforme o gateway

### `client`

- 1 app público
- pode ser desacoplado do runtime de worlds

### `world`

- app ou workload padronizado
- múltiplas instâncias por channel
- deploy separado de realms

### `mongodb`

- externo ao runtime
- gerenciado por serviço próprio

---

# Estratégia para Kubernetes

## Necessidade de planejamento

Kubernetes deve ser considerado desde já no plano, mesmo que não seja a primeira plataforma de execução.

## Como o modelo se traduz para Kubernetes

### `hub`

- Deployment
- Service interno
- ConfigMap/Secret para configuração

### `client`

- Deployment
- Service público ou Ingress

### `world`

- Deployment por template de runtime
- escalado por réplicas para channels
- realms podem usar Deployments separados ou namespaces separados, conforme nível de isolamento

### `gateway`

- Ingress Controller, Gateway API ou NGINX Ingress

### `mongodb`

- preferencialmente externo ao cluster

## Escalabilidade em Kubernetes

- HPA ou KEDA para channels
- scale baseado em CPU, memória ou métrica customizada de lotação
- realms novos criados por manifesto separado ou pipeline manual

## Benefício do planejamento antecipado

Se o stack local e o stack Azure seguirem o mesmo modelo lógico de serviços, a migração para Kubernetes será estruturalmente previsível.

---

# Como funcionará depois de pronto

## Fluxo operacional final

1. o `client` é servido pela entrada pública
2. o `client` consulta o `hub`
3. o `hub` responde com lista dinâmica de realms e channels ativos
4. o jogador escolhe um destino
5. o `client` conecta no `world` correspondente
6. se um novo channel subir, ele entra na lista sem reinício global
7. se um world cair, o hub remove ou marca indisponível após TTL
8. se um novo realm for lançado, ele aparece como novo servidor na lista

## Cenário de escala de capacidade

- lotação aumenta
- workflow ou autoscaler sobe novo channel
- novo channel registra-se no hub
- novos jogadores passam a enxergá-lo

## Cenário de lançamento de novo servidor

- equipe decide criar novo realm
- workflow publica o runtime com `REALM_ID` novo
- realm aparece como novo servidor competitivo
- progressão pode ser compartilhada ou isolada conforme política do realm

---

# Riscos

- replicar o stack antigo sem isolar de fato [`.env.scalable`](.env.scalable)
- manter `worlds` fixos demais e impedir scale real
- acoplar o hub a rotas ou hosts estáticos
- tentar usar auto-scaling para criação de realms em vez de channels
- depender do gateway local como se fosse solução final de cloud
- misturar experimentação escalável com os ambientes já funcionais

---

# Observações

- [`docker-multiworld-scalable/`](docker-multiworld-scalable/) continua sendo área de evolução controlada.
- Arquivos nessa pasta podem ser alterados, substituídos ou removidos.
- A pasta pode conter múltiplos Dockerfiles e múltiplos composes.
- A explicação operacional final deve permanecer documentada e atualizada conforme a topologia evoluir.
- Depois da implementação, deve existir documentação cruzada entre este plano e o documento operacional final em [`.vibecoding/plan/multiworld-scalable-runtime.md`](.vibecoding/plan/multiworld-scalable-runtime.md).
