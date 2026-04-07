# Stack multiworld escalável

Esta pasta expõe um starter principal único em [`stack.py`](docker-multiworld-scalable/stack.py), com menu interativo explícito para operar o stack escalável. O runtime base continua separado do gateway, mas a opção principal do menu agora sobe o nginx local automaticamente quando o modo selecionado for gateway local dedicado (`managed`). Quando o modo for externo/compartilhado (`external`), o fluxo deixa explícito que nenhum nginx local será iniciado.

## Estrutura

- [`stack.py`](docker-multiworld-scalable/stack.py): starter principal cross-platform com menu interativo
- [`.env.stack`](docker-multiworld-scalable/.env.stack): convenções operacionais compartilhadas do stack escalável
- [`start.cmd`](docker-multiworld-scalable/start.cmd), [`start.ps1`](docker-multiworld-scalable/start.ps1), [`start.sh`](docker-multiworld-scalable/start.sh): atalhos simples na raiz para abrir o menu principal
- [`starters/windows/`](docker-multiworld-scalable/starters/windows/): wrappers organizados para Windows
- [`starters/unix/start.sh`](docker-multiworld-scalable/starters/unix/start.sh): wrapper organizado para Unix
- [`docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml): runtime base com `hub` e `client`
- [`docker-compose.gateway.yml`](docker-multiworld-scalable/docker-compose.gateway.yml): compose opcional e separado para gateway local dedicado
- [`docker-compose.mongo-local.yml`](docker-multiworld-scalable/docker-compose.mongo-local.yml): Mongo local opcional com porta configurável
- [`gateway/nginx.conf`](docker-multiworld-scalable/gateway/nginx.conf): configuração do gateway local dedicado
- [`world/`](docker-multiworld-scalable/world/): pasta-modelo para novos canais
- [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/): canais iniciais
- [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml): compose reutilizado para subir o site do marketplace como projeto isolado

## Requisitos

- Python 3 disponível como `python` no Windows ou `python3` em Unix
- Docker Desktop ou engine Docker com suporte a [`docker compose`](docker-multiworld-scalable/docker-compose.yml)

## Modelo operacional

O stack passa a operar com dois modos explícitos de gateway:

- `GATEWAY_MODE=external`: modo padrão. A opção 1 **não** sobe nginx e apenas propaga o endereço público do projeto para client e worlds.
- `GATEWAY_MODE=managed`: o projeto usa um gateway local dedicado. O gateway continua em compose separado, porém a opção 1 sobe esse nginx automaticamente como parte do fluxo completo/local.

Separação aplicada:

- runtime base: `hub`, `client`, `world-*`
- infraestrutura opcional local: Mongo local
- borda opcional local: gateway dedicado em compose separado
- borda recomendada: gateway externo/compartilhado

## Menu principal

O menu em [`stack.py`](docker-multiworld-scalable/stack.py) oferece estas opções:

1. **Iniciar stack completo/local**
   - mostra a configuração operacional atual carregada de [`.env.stack`](docker-multiworld-scalable/.env.stack)
   - deixa explícito, antes de confirmar, se a opção 1 irá subir também o gateway/nginx local ou se usará gateway externo/compartilhado
   - pergunta se a própria opção 1 deve subir também o gateway local dedicado deste projeto (`managed`) ou se o acesso público ficará em gateway externo/compartilhado (`external`)
   - pergunta a porta pública e o host público do gateway/proxy do projeto
   - pergunta se vai usar Mongo local
   - coleta host, porta, usuário, senha, nome do banco e `authSource` do MongoDB
   - em perguntas com valor padrão, basta pressionar `Enter` para aceitar o valor exibido
   - garante que [`hub/.env`](docker-multiworld-scalable/hub/.env) e [`client/.env`](docker-multiworld-scalable/client/.env) existam a partir de [`.env.scalable`](.env.scalable) antes de propagar os ajustes operacionais do stack
   - persiste essas escolhas em [`.env.stack`](docker-multiworld-scalable/.env.stack) e propaga para [`hub/.env`](docker-multiworld-scalable/hub/.env), [`client/.env`](docker-multiworld-scalable/client/.env), [`mongo-local/.env`](docker-multiworld-scalable/mongo-local/.env), [`world/.env.example`](docker-multiworld-scalable/world/.env.example) e nos `.env` de worlds já existentes
   - quando o env efetivo do client muda, informa explicitamente que a base será rebuildada para recompilar o bundle com o endpoint público atualizado
   - sobe primeiro o Mongo local com [`docker-compose.mongo-local.yml`](docker-multiworld-scalable/docker-compose.mongo-local.yml) quando configurado e aguarda resposta real a `ping` antes dos serviços dependentes
   - sobe o `hub` somente depois do Mongo estar pronto e aguarda a API HTTP responder em [`/`](packages/hub/src/controllers/api.ts:111)
   - sobe o `client` somente depois do `hub` estar operacional
   - sobe os canais iniciais existentes [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/)
   - quando `GATEWAY_MODE=managed`, sobe também o gateway dedicado com [`docker-compose.gateway.yml`](docker-multiworld-scalable/docker-compose.gateway.yml)
   - quando `GATEWAY_MODE=external`, conclui sem iniciar nginx local
2. **Novo canal**
   - cria o próximo `world-N` a partir de [`world/`](docker-multiworld-scalable/world/)
   - mantém a convenção automática de portas, `SERVER_ID`, `CHANNEL_ID` e `COMPOSE_PROJECT_NAME`
   - herda as convenções compartilhadas atuais de gateway e MongoDB já persistidas
   - pode opcionalmente já subir o novo canal após a criação
3. **Remover canal**
   - lista os canais configurados
   - canais-base [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/) exigem confirmação e sofrem apenas `down`, sem apagar diretório
   - canais adicionais param e têm o diretório removido apenas após confirmação clara
4. **Listar mundos ativos**
   - identifica worlds ativos por projeto Docker Compose e imprime uma lista simples
5. **Logs**
   - monta um submenu com nomes simplificados a partir de `docker ps`
   - permite escolher `gateway/nginx`, `hub`, `client`, `mongo` ou `world-N` sem decorar o nome completo do container
   - aceita `ESC` para voltar ao menu principal
   - abre `docker logs -f` apenas quando essa opção é escolhida
6. **Editar chave de env em lote nos worlds**
   - pergunta explicitamente a chave e o novo valor, com fluxo simples para casos como `GVER`
   - aplica a mudança em todos os `.env` de worlds existentes
   - permite reiniciar os worlds afetados logo após a alteração
7. **Iniciar apenas gateway local dedicado**
   - valida se `GATEWAY_MODE=managed`
   - valida se a rede [`acacia-scalable-runtime`](docker-multiworld-scalable/docker-compose.yml) já existe
   - sobe o gateway com [`docker-compose.gateway.yml`](docker-multiworld-scalable/docker-compose.gateway.yml)
8. **Gerenciar site do marketplace isolado**
   - abre um submenu dedicado para o compose do marketplace
   - permite iniciar o site usando [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml) com projeto Docker Compose isolado
   - permite parar apenas esse compose isolado sem afetar o stack escalável
   - permite parada com limpeza coerente de volumes/imagens locais do projeto isolado
9. **Exit**
   - permanece como último item visível do menu principal
   - encerra o menu com código `0`

Nos submenus, `ESC` volta ao nível anterior. O valor `0` não é mais usado como instrução de navegação.

## Uso

### Windows CMD

```cmd
cd docker-multiworld-scalable
start.cmd
```

### Windows PowerShell

```powershell
Set-Location docker-multiworld-scalable
.\start.ps1
```

### Linux/macOS

```sh
cd docker-multiworld-scalable
./start.sh
```

### Execução direta do starter principal

```bash
python docker-multiworld-scalable/stack.py
```

No Windows, se preferir manter os wrappers organizados por SO:

```cmd
cd docker-multiworld-scalable
starters\windows\start.cmd
```

```powershell
Set-Location docker-multiworld-scalable
.\starters\windows\start.ps1
```

Em Unix:

```sh
cd docker-multiworld-scalable
./starters/unix/start.sh
```

## Arquivo compartilhado de configuração

O arquivo [`.env.stack`](docker-multiworld-scalable/.env.stack) é criado automaticamente pelo starter principal quando necessário. Ele guarda as convenções operacionais compartilhadas do stack, como:

- `GATEWAY_MODE`
- `GATEWAY_PUBLIC_PORT`
- `GATEWAY_PUBLIC_HOST`
- `USE_MONGO_LOCAL`
- `MONGODB_HOST`
- `MONGODB_PORT`
- `MONGODB_USER`
- `MONGODB_PASSWORD`
- `MONGODB_DATABASE`
- `MONGODB_AUTH_SOURCE`
- `MONGODB_TLS`
- `MONGODB_SRV`

O compose base, o compose opcional do gateway local e o compose opcional de Mongo local usam esse arquivo para manter previsibilidade entre o menu, os `.env` dos serviços e os novos worlds.

Além disso, o starter trata [`.env.scalable`](.env.scalable) como base do stack escalável para materializar [`hub/.env`](docker-multiworld-scalable/hub/.env) e [`client/.env`](docker-multiworld-scalable/client/.env) quando necessário. Isso evita build do client com configuração divergente do stack escalável.

## O que acontece ao iniciar a opção 1

A opção **Iniciar stack completo/local** executa, em sequência lógica estrita:

```bash
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.mongo-local.yml up -d
# stack.py aguarda o Mongo local responder a ping antes de continuar
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.yml up --build -d hub
# stack.py aguarda a API HTTP do hub responder antes de continuar
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.yml up --build -d client
docker compose --env-file docker-multiworld-scalable/.env.stack --env-file docker-multiworld-scalable/world-1/.env -f docker-multiworld-scalable/world-1/docker-compose.yml up --build -d
docker compose --env-file docker-multiworld-scalable/.env.stack --env-file docker-multiworld-scalable/world-2/.env -f docker-multiworld-scalable/world-2/docker-compose.yml up --build -d
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.gateway.yml up --build -d gateway
```

O passo do Mongo local só ocorre quando `USE_MONGO_LOCAL=true`.

Comportamento final da opção 1:

- se `GATEWAY_MODE=managed`, o starter sobe `hub`, `client`, worlds e também o nginx local dedicado
- se `GATEWAY_MODE=external`, o starter sobe apenas runtime base + worlds e deixa explícito que o acesso público depende de gateway externo/compartilhado

O gateway continua fora do compose base, mas não fica mais fora do fluxo da opção 1 quando o usuário escolhe o modo local dedicado.

O `up --build` da base continua intencional: ele garante que o [`docker-multiworld-scalable/client/Dockerfile`](docker-multiworld-scalable/client/Dockerfile:14) recopie o [`client/.env`](docker-multiworld-scalable/client/.env) atualizado antes do [`yarn build`](docker-multiworld-scalable/client/Dockerfile:23), recompilando o bundle com os valores corretos do endpoint público do hub/gateway.

## Gateway externo/compartilhado

Este é o modo recomendado.

Regras:

- o stack principal não sobe nginx
- o navegador deve acessar o host público configurado em `GATEWAY_PUBLIC_HOST:GATEWAY_PUBLIC_PORT`
- o client recebe esse host público, não mais o hostname Docker `gateway`
- worlds continuam falando com `hub` internamente via rede Docker
- o gateway compartilhado pode estar na mesma rede Docker do projeto ou encaminhar para portas publicadas externamente, conforme a operação local

## Gateway local dedicado opcional

Quando for necessário subir um nginx local por projeto, ele continua explícito e separado em compose próprio:

```bash
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.gateway.yml up --build -d gateway
```

Esse compose:

- usa a mesma rede [`acacia-scalable-runtime`](docker-multiworld-scalable/docker-compose.yml)
- depende de a base já ter criado essa rede
- não volta a fazer parte do runtime principal
- pode ser iniciado automaticamente pela opção 1 quando `GATEWAY_MODE=managed`
- também pode ser iniciado isoladamente pela opção **Iniciar apenas gateway local dedicado**

## Marketplace isolado

A opção **Gerenciar site do marketplace isolado** reutiliza diretamente [`Marketplace/docker/docker-compose.yml`](Marketplace/docker/docker-compose.yml), mas o chama como um projeto Docker Compose próprio e separado do stack escalável.

Fluxo aplicado:

```bash
docker compose -p acacia-marketplace-isolated --project-directory Marketplace/docker -f Marketplace/docker/docker-compose.yml up --build -d
```

Para parar sem limpeza:

```bash
docker compose -p acacia-marketplace-isolated --project-directory Marketplace/docker -f Marketplace/docker/docker-compose.yml down --remove-orphans
```

Para parar com limpeza coerente do compose isolado:

```bash
docker compose -p acacia-marketplace-isolated --project-directory Marketplace/docker -f Marketplace/docker/docker-compose.yml down --remove-orphans --volumes --rmi local
```

Regras dessa opção:

- não reutiliza o compose base de [`docker-multiworld-scalable/`](docker-multiworld-scalable/)
- não depende do gateway/nginx do stack escalável
- não injeta [`.env.stack`](docker-multiworld-scalable/.env.stack) no compose do marketplace
- mantém nome de projeto próprio para que subida, parada e limpeza ocorram de forma isolada

## Convenção automática de novos canais

Ao criar um novo canal, [`stack.py`](docker-multiworld-scalable/stack.py) aplica a convenção existente e também injeta as configurações compartilhadas atuais de gateway e MongoDB:

- detecta o maior diretório no formato `world-*`
- cria o próximo diretório sequencial, por exemplo `world-3/`
- copia [`world/.env.example`](docker-multiworld-scalable/world/.env.example) para `world-N/.env`
- ajusta automaticamente:
  - `WORLD_DIRECTORY=world-N`
  - `COMPOSE_PROJECT_NAME=acacia-scalable-world-N`
  - `SERVER_ID=100+N`
  - `CHANNEL_ID=N`
  - `REALM_ID=realm-1`
  - `PORT` e `PUBLIC_GAME_PORT`
  - `API_PORT` e `PUBLIC_API_PORT`
  - `NAME='Shinobi Farm - Realm 1 Channel N'`
  - `DISCORD_CHANNEL_ID=N`
  - `GATEWAY_MODE`, `GATEWAY_PUBLIC_HOST` e `GATEWAY_PUBLIC_PORT`
  - `CLIENT_REMOTE_HOST`, `CLIENT_REMOTE_PORT`, `REMOTE_SERVER_HOST` e `REMOTE_API_HOST` conforme o endereço público configurado
  - `MONGODB_*` conforme a convenção atual do stack
- mantém a convenção atual de portas em passos de `2`

Exemplo inicial:

- `world-1`: jogo `9101`, API `9102`
- `world-2`: jogo `9103`, API `9104`
- `world-3`: jogo `9105`, API `9106`
- `world-4`: jogo `9107`, API `9108`

## Remoção de canal

A opção **Remover canal** foi desenhada para segurança operacional:

- para sempre o compose do canal escolhido antes de qualquer remoção
- nunca apaga automaticamente os canais-base [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/)
- remove diretório apenas para canais adicionais e somente após confirmação explícita

## Logs simplificados

A opção **Logs** usa `docker ps` para encontrar containers ativos e simplificar os nomes apresentados no submenu. O usuário escolhe pelo papel operacional, não pelo nome exato do container.

Exemplos esperados no submenu:

- `gateway/nginx`
- `hub`
- `client`
- `mongo`
- `world-1`
- `world-2`

## Endpoints e portas públicas

A base expõe:

- hub API em `http://localhost:9526`
- hub websocket interno em `ws://localhost:9527`
- client interno na rede Docker em `client:9000`
- worlds conectados internamente ao `hub`

A borda pública passa a ser definida apenas pela configuração de gateway/proxy do projeto:

- `http://<GATEWAY_PUBLIC_HOST>:<GATEWAY_PUBLIC_PORT>`
- `ws://<GATEWAY_PUBLIC_HOST>:<GATEWAY_PUBLIC_PORT>/hub/ws` para o websocket do hub
- `ws://<GATEWAY_PUBLIC_HOST>:<GATEWAY_PUBLIC_PORT>/ws?serverId=<SERVER_ID>&port=<PORT>` para o websocket público de cada world via gateway

## Starters antigos

Os scripts antigos separados por ação deixaram de ser o fluxo principal e passam a ser considerados descontinuados para operação diária:

- [`stop.cmd`](docker-multiworld-scalable/stop.cmd)
- [`stop.ps1`](docker-multiworld-scalable/stop.ps1)
- [`stop.sh`](docker-multiworld-scalable/stop.sh)
- [`new-world.cmd`](docker-multiworld-scalable/new-world.cmd)
- [`new-world.ps1`](docker-multiworld-scalable/new-world.ps1)
- [`new-world.sh`](docker-multiworld-scalable/new-world.sh)

Eles podem ser removidos em uma limpeza posterior, mas o fluxo recomendado agora é centralizar tudo em [`stack.py`](docker-multiworld-scalable/stack.py).
