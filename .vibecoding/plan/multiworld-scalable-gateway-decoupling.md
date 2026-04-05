# Objetivo

Definir a arquitetura alvo para desacoplar o gateway/nginx do stack base em [`docker-multiworld-scalable/`](docker-multiworld-scalable/), tratando o gateway como serviço/container apartado do mesmo modo que o Mongo, para permitir uso compartilhado por múltiplos projetos sem subir um nginx por stack.

---

# Contexto

O estado atual ainda mantém acoplamento operacional entre gateway e stack base:

- [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml) inclui `hub`, `client` e `gateway` no mesmo compose base
- [`docker-multiworld-scalable/stack.py`](docker-multiworld-scalable/stack.py) sempre coleta host/porta pública do gateway, propaga esse gateway para envs e sempre sobe o serviço ao final
- [`docker-multiworld-scalable/gateway/nginx.conf`](docker-multiworld-scalable/gateway/nginx.conf) assume descoberta interna de `client` e `hub` via DNS Docker na rede `acacia-scalable-runtime`
- o plano existente em [`.vibecoding/plan/multiworld-scalable-rollout.md`](.vibecoding/plan/multiworld-scalable-rollout.md) já previa `mongodb` e `gateway público` como serviços externos ou externalizáveis

A decisão confirmada pelo usuário é que o gateway não deve permanecer acoplado ao grupo `scalable-base`. Ele deve ser tratado como dependência operacional separada, podendo inclusive ser compartilhado entre projetos distintos.

---

# Decisões aplicadas

- O runtime base escalável deixa de incluir gateway como parte obrigatória do stack.
- O gateway passa a ser classificado como infraestrutura de borda, não como serviço core de runtime.
- A recomendação principal é separar o gateway em compose/projeto próprio opcional, e não apenas mantê-lo como serviço no mesmo compose base.
- O stack deve suportar explicitamente dois modos:
  - gateway gerenciado pelo projeto local
  - gateway gerenciado externamente/compartilhado
- O comportamento padrão de descoberta continua centrado no `hub`; o gateway não participa da descoberta lógica de worlds.
- O alinhamento operacional deve seguir o mesmo princípio já aplicado ao Mongo: o stack consome um endpoint/host configurado, mas não depende de gerenciar o ciclo de vida desse serviço.

---

# Estratégia

## Arquitetura alvo

A topologia recomendada passa a ser:

- runtime base do projeto:
  - `hub`
  - `client`
  - `world-*`
- dependências externalizáveis:
  - `mongodb`
  - `gateway público`

## Recomendação principal

O gateway deve virar **projeto/compose separado opcional**.

Motivos:

- evita que cada projeto suba seu próprio nginx por padrão
- permite um gateway compartilhado rotear múltiplos projetos
- aproxima o desenho local do alvo de cloud, onde o gateway tende a ser externo ou gerenciado
- reduz o acoplamento do [`stack.py`](docker-multiworld-scalable/stack.py) com detalhes de borda HTTP
- mantém coerência com a decisão já aplicada a Mongo externo

## Recomendação secundária rejeitada como padrão

Manter o gateway apenas como serviço isolado fora do grupo `scalable-base`, mas ainda no mesmo [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml), melhora parcialmente o acoplamento de subida, porém ainda mantém:

- o manifesto base misturando runtime com borda
- incentivo a subir um nginx por projeto
- menor clareza para cenários com gateway compartilhado

Essa opção pode existir apenas como etapa de transição, não como arquitetura alvo final.

---

# Impactos esperados

## Impacto em [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml)

### Alvo

O compose base deve representar apenas o runtime essencial do projeto.

### Diretriz

Remover `gateway` do compose base principal e manter nele somente:

- `hub`
- `client`
- rede `acacia-scalable-runtime`

### Estrutura recomendada

Adotar um dos seguintes arranjos, com preferência pela primeira opção:

#### Opção recomendada

- [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml): runtime base (`hub` + `client`)
- novo compose de gateway separado, por exemplo em `docker-multiworld-scalable/gateway/docker-compose.yml` ou `docker-multiworld-scalable/docker-compose.gateway.yml`

#### Opção transitória

- manter compose base
- criar compose adicional apenas para `gateway`
- remover o gateway do fluxo padrão do compose base

### Regra de rede

O gateway separado pode continuar se conectando à rede Docker compartilhada quando estiver no mesmo host local, mas isso deve ser tratado como detalhe de operação local, não como pressuposto do runtime base.

---

## Impacto em [`docker-multiworld-scalable/stack.py`](docker-multiworld-scalable/stack.py)

### Problema atual

Hoje o starter mistura três responsabilidades:

- bootstrap do runtime
- bootstrap opcional de Mongo
- bootstrap obrigatório do gateway

### Diretriz de refatoração

[`docker-multiworld-scalable/stack.py`](docker-multiworld-scalable/stack.py) deve passar a tratar gateway como dependência **externa ou opcionalmente gerenciada**, nunca como parte obrigatória do start do stack.

### Comportamento alvo

O starter deve separar claramente:

- gestão do runtime base
- gestão opcional de Mongo local
- gestão opcional de gateway local

### Cenários que o starter deve suportar

#### Cenário A — gateway externo/compartilhado

O starter:

- não sobe gateway
- não espera container `gateway`
- não depende de DNS Docker com hostname `gateway`
- apenas coleta e propaga dados públicos necessários para o client e para os worlds

#### Cenário B — gateway local gerenciado separadamente

O starter do stack principal:

- sobe `hub`, `client` e worlds
- pode exibir instrução operacional para subir o gateway separado
- opcionalmente pode, em etapa posterior, oferecer uma ação explícita e separada para operar o gateway, sem misturar isso ao start principal

### Ajustes funcionais esperados

Planejar alteração em pontos equivalentes a:

- remoção da obrigatoriedade de [`start_gateway()`](docker-multiworld-scalable/stack.py:762)
- revisão de [`start_full_stack()`](docker-multiworld-scalable/stack.py:782) para que a conclusão do stack não dependa de gateway local
- revisão de [`collect_stack_settings()`](docker-multiworld-scalable/stack.py:493) para diferenciar:
  - host/porta públicos do sistema
  - modo de gestão do gateway
- revisão de [`apply_stack_settings()`](docker-multiworld-scalable/stack.py:571) para não assumir `HUB_HOST='gateway'` no client quando o gateway não for um hostname Docker interno

---

## Impacto em envs

### Problema atual

As chaves atuais misturam:

- endereço público consumido por client e worlds
- identidade do container local do gateway
- semântica de gerenciamento do gateway

Exemplo: em [`apply_stack_settings()`](docker-multiworld-scalable/stack.py:597), o client recebe `HUB_HOST='gateway'`, o que só funciona quando existe um container interno com esse nome.

### Diretriz

Separar conceitos de configuração.

## Grupos de configuração recomendados

### 1. Modo de operação do gateway

Adicionar convenção explícita, por exemplo:

- `GATEWAY_MODE=external|managed`

Sem obrigar agora o nome exato, mas preservando esta semântica.

### 2. Endereço público do projeto

Manter ou evoluir campos para representar a borda pública consumida pelo navegador:

- host público
- porta pública
- opcionalmente protocolo/base URL

### 3. Endereços internos de runtime

Preservar separação entre endpoints internos e públicos:

- `hub` interno continua acessível por nome Docker para `worlds`
- `client` interno continua acessível por nome Docker para um gateway local, se existir
- browser nunca deve depender de hostname interno `gateway`

### Regra de propagação

- `worlds` continuam falando com `hub` interno por rede Docker
- `client` deve receber configuração pública resolvível pelo navegador
- quando existir gateway externo compartilhado, a configuração do client deve apontar para hostname público real, não para `gateway`

### Compatibilidade mínima

Enquanto houver transição, o plano deve preservar compatibilidade com os campos atuais:

- `GATEWAY_PUBLIC_HOST`
- `GATEWAY_PUBLIC_PORT`

Mas o uso deles deve deixar de implicar que o compose local gerencia um container `gateway`.

---

## Impacto em portas públicas, hostnames e service discovery

## Portas públicas

A porta pública deixa de ser atributo de um container obrigatório do stack.

Ela passa a significar apenas:

- porta da borda pública pela qual o navegador acessa o sistema

Consequência:

- o stack pode rodar sem publicar nenhuma porta HTTP local própria, exceto as que ainda forem úteis para debug direto
- em ambiente com gateway compartilhado, a publicação externa pode ser feita totalmente fora do compose do projeto

## Hostnames

Devem existir dois domínios de nomenclatura:

### Internos

Usados entre containers do projeto:

- `hub`
- `client`
- `world-*`
- `mongo-local` quando aplicável

### Públicos

Usados por navegador e por integrações externas:

- hostname do gateway compartilhado
- hostname ou path prefix do projeto publicado nesse gateway

### Diretriz importante

Não usar mais `gateway` como hostname semântico público. Esse nome deve ser apenas detalhe de infraestrutura local quando existir um gateway containerizado no mesmo host.

## Service discovery

O gateway não deve descobrir worlds diretamente.

A descoberta lógica permanece:

- `world` registra-se no `hub`
- `hub` publica worlds disponíveis
- `client` consulta o `hub`
- o gateway só encaminha HTTP/WebSocket para os endpoints públicos do projeto

Isso evita transformar nginx em ponto de cadastro manual de `world-*` e preserva a independência de escala horizontal.

---

# Como o stack deve funcionar com gateway externo/compartilhado

## Fluxo alvo

1. o operador sobe Mongo local opcional, se necessário
2. o operador sobe `hub`
3. o operador sobe `client`
4. o operador sobe `world-*`
5. um gateway externo já existente, ou uma camada de borda separada, publica o acesso HTTP/WebSocket do projeto
6. o navegador acessa o hostname público do projeto
7. o `client` consulta o `hub` por endpoint público compatível
8. o `hub` informa os worlds ativos
9. o jogador conecta no destino disponível

## Condições operacionais

Para isso funcionar, o projeto precisa expor e documentar:

- qual hostname público o navegador usa
- qual rota pública chega ao hub HTTP
- qual rota pública chega ao hub WebSocket
- como o gateway compartilha a rede ou resolve os upstreams do projeto quando estiver no mesmo host
- ou, alternativamente, como encaminha para portas publicadas diretamente pelos serviços, quando não estiver na mesma rede Docker

## Regra de borda pública

O gateway compartilhado deve rotear por hostname, path prefix ou combinação de ambos.

A recomendação preferencial é:

- isolamento por hostname/subdomínio por projeto

Motivos:

- menos colisão de rotas entre projetos
- menor complexidade no client
- menor necessidade de reescrever paths de assets e websocket

Path prefix pode existir, mas aumenta a complexidade e não deve ser o padrão inicial do plano.

---

# Compatibilidade com o fluxo atual de Mongo separado

A analogia operacional recomendada é direta:

- `USE_MONGO_LOCAL=true` continua significando que o projeto sobe uma dependência local opcional
- o novo modo de gateway deve seguir lógica semelhante: o projeto pode operar com gateway gerenciado fora do stack principal

Diferença importante:

- Mongo é dependência de dados privada ao runtime
- gateway é dependência de borda potencialmente compartilhada entre múltiplos projetos

Por isso, o gateway deve ficar ainda mais desacoplado do runtime base do que Mongo.

---

# Sequência de implementação segura

## Etapa 1 — separar a decisão arquitetural no starter

Resultado verificável:

- o fluxo principal do stack deixa de pressupor que sempre haverá container `gateway`

Ações planejadas:

- introduzir modo operacional explícito para gateway
- remover dependência obrigatória de `start_gateway()`
- manter start principal focado em `hub`, `client`, `worlds` e Mongo opcional

## Etapa 2 — remover o gateway do compose base

Resultado verificável:

- [`docker-multiworld-scalable/docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml) representa apenas runtime base

Ações planejadas:

- retirar `gateway` do manifesto principal
- criar compose/manifests separados para gateway local opcional
- manter rede compartilhada apenas quando necessário para operação local

## Etapa 3 — separar configuração pública de configuração interna

Resultado verificável:

- envs deixam de depender do hostname Docker `gateway` para funcionamento do client no navegador

Ações planejadas:

- revisar propagação de `HUB_HOST`, `HUB_WS_HOST`, `CLIENT_REMOTE_HOST` e correlatos
- distinguir endpoint interno de runtime e endpoint público de navegação
- preservar compatibilidade transitória com `GATEWAY_PUBLIC_HOST` e `GATEWAY_PUBLIC_PORT`

## Etapa 4 — formalizar operação com gateway externo

Resultado verificável:

- existe documentação operacional clara para subir o stack sem nginx local acoplado

Ações planejadas:

- documentar cenário com gateway compartilhado
- documentar pré-requisitos de hostname, rotas e websocket
- documentar como um gateway local separado pode se conectar ao stack quando necessário

## Etapa 5 — manter fallback local sem comprometer o alvo

Resultado verificável:

- desenvolvimento local ainda pode usar nginx containerizado, mas fora do stack base

Ações planejadas:

- manter gateway local como artefato opcional
- evitar que esse fallback dite a arquitetura principal

---

# Riscos

- remover o gateway do compose base sem revisar a propagação de envs no client, mantendo referência inválida a `gateway`
- assumir que o gateway compartilhado sempre estará na mesma rede Docker do projeto
- misturar hostname interno de container com hostname público resolvido pelo navegador
- tentar mover descoberta de worlds para nginx, recriando acoplamento manual
- adotar path prefix cedo demais e introduzir complexidade desnecessária em assets e websocket
- manter documentação operacional antiga afirmando que o stack sempre sobe `gateway` por último

---

# Observações

- A ausência de [`.vibecoding/decisions/decisions.md`](.vibecoding/decisions/decisions.md) e [`.vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md) no workspace foi tratada como lacuna de contexto; este plano se apoia no material existente em [`.vibecoding/plan/multiworld-architecture.md`](.vibecoding/plan/multiworld-architecture.md) e [`.vibecoding/plan/multiworld-scalable-rollout.md`](.vibecoding/plan/multiworld-scalable-rollout.md).
- A recomendação arquitetural final desta etapa é: **gateway como compose/projeto separado opcional, fora do runtime base, com suporte explícito a modo externo/compartilhado**.
- A implementação posterior em [`docker-multiworld-scalable/stack.py`](docker-multiworld-scalable/stack.py) deve ser feita em passos pequenos, priorizando primeiro desacoplamento de fluxo e envs, e só depois reorganização de manifests e documentação operacional.