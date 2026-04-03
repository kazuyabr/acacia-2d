# Stack multiworld escalável

Esta pasta expõe um starter principal único em [`stack.py`](docker-multiworld-scalable/stack.py), com menu interativo explícito para operar o stack escalável. O fluxo agora inclui bootstrap configurável de gateway/nginx e MongoDB, persistência das escolhas operacionais nos `.env` relevantes e utilitário simples para edição em lote nos worlds.

## Estrutura

- [`stack.py`](docker-multiworld-scalable/stack.py): starter principal cross-platform com menu interativo
- [`.env.stack`](docker-multiworld-scalable/.env.stack): convenções operacionais compartilhadas do stack escalável
- [`start.cmd`](docker-multiworld-scalable/start.cmd), [`start.ps1`](docker-multiworld-scalable/start.ps1), [`start.sh`](docker-multiworld-scalable/start.sh): atalhos simples na raiz para abrir o menu principal
- [`starters/windows/`](docker-multiworld-scalable/starters/windows/): wrappers organizados para Windows
- [`starters/unix/start.sh`](docker-multiworld-scalable/starters/unix/start.sh): wrapper organizado para Unix
- [`docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml): base com `hub`, `client` e `gateway`
- [`docker-compose.mongo-local.yml`](docker-multiworld-scalable/docker-compose.mongo-local.yml): Mongo local opcional com porta configurável
- [`gateway/nginx.conf`](docker-multiworld-scalable/gateway/nginx.conf): configuração do gateway do stack escalável
- [`world/`](docker-multiworld-scalable/world/): pasta-modelo para novos canais
- [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/): canais iniciais

## Requisitos

- Python 3 disponível como `python` no Windows ou `python3` em Unix
- Docker Desktop ou engine Docker com suporte a [`docker compose`](docker-multiworld-scalable/docker-compose.yml)

## Menu principal

O menu em [`stack.py`](docker-multiworld-scalable/stack.py) oferece estas opções:

1. **Iniciar o projeto inteiro**
   - mostra a configuração operacional atual carregada de [`.env.stack`](docker-multiworld-scalable/.env.stack)
   - pergunta a porta pública do `gateway/nginx`, usando `80` como padrão efetivo quando a resposta vier vazia
   - pergunta o host público do gateway, para refletir nos envs dos serviços
   - pergunta se vai usar Mongo local
   - coleta host, porta, usuário, senha, nome do banco e `authSource` do MongoDB
   - em perguntas com valor padrão, basta pressionar `Enter` para aceitar o valor exibido
   - persiste essas escolhas em [`.env.stack`](docker-multiworld-scalable/.env.stack) e propaga para [`hub/.env`](docker-multiworld-scalable/hub/.env), [`client/.env`](docker-multiworld-scalable/client/.env), [`mongo-local/.env`](docker-multiworld-scalable/mongo-local/.env), [`world/.env.example`](docker-multiworld-scalable/world/.env.example) e nos `.env` de worlds já existentes
   - sobe a base com [`docker-compose.yml`](docker-multiworld-scalable/docker-compose.yml), incluindo explicitamente o `gateway/nginx`
   - sobe o Mongo local com [`docker-compose.mongo-local.yml`](docker-multiworld-scalable/docker-compose.mongo-local.yml) apenas quando configurado
   - sobe os canais iniciais existentes [`world-1/`](docker-multiworld-scalable/world-1/) e [`world-2/`](docker-multiworld-scalable/world-2/)
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
7. **Exit**
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

O compose base e o compose opcional de Mongo local usam esse arquivo para manter previsibilidade entre o menu, os `.env` dos serviços e os novos worlds.

## O que acontece ao iniciar o projeto inteiro

A opção **Iniciar o projeto inteiro** executa, em sequência lógica:

```bash
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.yml up --build -d
docker compose --env-file docker-multiworld-scalable/.env.stack -f docker-multiworld-scalable/docker-compose.mongo-local.yml up -d
docker compose --env-file docker-multiworld-scalable/.env.stack --env-file docker-multiworld-scalable/world-1/.env -f docker-multiworld-scalable/world-1/docker-compose.yml up --build -d
docker compose --env-file docker-multiworld-scalable/.env.stack --env-file docker-multiworld-scalable/world-2/.env -f docker-multiworld-scalable/world-2/docker-compose.yml up --build -d
```

O passo do Mongo local só ocorre quando `USE_MONGO_LOCAL=true` na configuração coletada pelo menu.

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
  - `CLIENT_REMOTE_HOST`, `CLIENT_REMOTE_PORT`, `REMOTE_SERVER_HOST` e `REMOTE_API_HOST` conforme o gateway configurado
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

## Edição em lote de env nos worlds

A opção **Editar chave de env em lote nos worlds** foi mantida explícita de propósito:

- sem automação opaca
- sem inferência escondida por serviço
- apenas pergunta chave e valor
- mostra os arquivos alterados
- oferece reinício opcional dos worlds afetados

Isso cobre casos operacionais simples como atualizar `GVER` em todos os canais e reiniciar apenas os serviços impactados.

## Gateway e portas expostas

A base expõe:

- gateway HTTP em `http://localhost:<porta-configurada>`
- client servido atrás do gateway
- hub API em `http://localhost:9526`
- websocket público do jogo em `ws://localhost:<porta-configurada>/ws`
- hub websocket interno em `ws://localhost:9527`

Com a configuração padrão atual do starter, o gateway usa a porta pública `80` quando o usuário apenas pressiona `Enter` no prompt. O valor continua configurável no menu e persistido em [`.env.stack`](docker-multiworld-scalable/.env.stack).

## Starters antigos

Os scripts antigos separados por ação deixaram de ser o fluxo principal e passam a ser considerados descontinuados para operação diária:

- [`stop.cmd`](docker-multiworld-scalable/stop.cmd)
- [`stop.ps1`](docker-multiworld-scalable/stop.ps1)
- [`stop.sh`](docker-multiworld-scalable/stop.sh)
- [`new-world.cmd`](docker-multiworld-scalable/new-world.cmd)
- [`new-world.ps1`](docker-multiworld-scalable/new-world.ps1)
- [`new-world.sh`](docker-multiworld-scalable/new-world.sh)

Eles podem ser removidos em uma limpeza posterior, mas o fluxo recomendado agora é centralizar tudo em [`stack.py`](docker-multiworld-scalable/stack.py).
