# Acacia

[![Version](https://img.shields.io/github/package-json/v/Kaetram/Kaetram-Open)](https://github.com/Kaetram/Kaetram-Open/releases/latest 'Version')
[![MPL-2.0 License](https://img.shields.io/github/license/Kaetram/Kaetram-Open)][license]
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fkaetram.com&style=flat)](https://kaetram.com 'Website')
[![Build Status](https://img.shields.io/github/actions/workflow/status/Kaetram/Kaetram-Open/build.yml?branch=develop&label=build)](https://github.com/Kaetram/Kaetram-Open/actions/workflows/build.yml 'Build Status')
[![E2E Status](https://img.shields.io/github/actions/workflow/status/Kaetram/Kaetram-Open/e2e.yml?branch=develop&label=e2e)](https://github.com/Kaetram/Kaetram-Open/actions/workflows/e2e.yml 'E2E Status')
[![Open Issues](https://img.shields.io/github/issues/Kaetram/Kaetram-Open)][issues]

[![Watch](https://img.shields.io/github/watchers/Kaetram/Kaetram-Open?style=social&icon=github)](https://github.com/Kaetram/Kaetram-Open/subscription 'Watch')
[![Stars](https://img.shields.io/github/stars/Kaetram/Kaetram-Open?style=social&icon=github)](https://github.com/Kaetram/Kaetram-Open/stargazers 'Stars')
[![Fork](https://img.shields.io/github/forks/Kaetram/Kaetram-Open?style=social&icon=github)](https://github.com/Kaetram/Kaetram-Open/fork 'Fork')
[![Discord](https://img.shields.io/discord/583033499741847574?logo=discord&color=5865f2&labelColor=fff&style=flat)][discord]
[![YouTube](https://img.shields.io/badge/YouTube-white?logo=youtube&logoColor=f00)](https://www.youtube.com/channel/UC0atP4sQbb4LJd6y4jijOHg 'YouTube')
[![Twitter](https://img.shields.io/twitter/follow/kaetramofficial?style=social)](https://twitter.com/kaetramofficial 'Twitter')
[![Reddit](https://img.shields.io/reddit/subreddit-subscribers/kaetram?style=social)](https://reddit.com/r/kaetram 'Reddit')

Projeto Acacia é um sistema derivado do projeto de código aberto Kaetram e tem toda uma estrutra que sera aos poucos migrada para um projeto proprietario descontinuando o uso de Kaetram como base.
Esta versão sera para sempre código aberto.

# Kaetram

Kaetram é um MMORPG 2D de código aberto que expande a ideia original criada pelo BrowserQuest (BQ) da Little Workshop. Nosso objetivo é fornecer uma experiência colaborativa de jogo, bem como um motor de jogo para aqueles interessados em criar sua própria versão. O jogo ainda está em estágios iniciais de desenvolvimento e toda ajuda, sugestões e relatórios de bugs são bem-vindos. Todos os recursos são licenciados sob CC-BY-SA3.0 e pretendemos manter os recursos originais do BQ, bem como expandi-los. Toda a base de código foi reescrita do zero, otimizada e documentada. Consulte o wiki do GitHub para obter informações sobre desenvolvimento. Kaetram começou seu desenvolvimento em 2015 sob o nome de Tap Tap Adventure (TTA). Em 2017, Kaetram foi iniciado como uma reescrita completa do código que era anteriormente baseado em BQ.

Versão Live &ndash; <https://kaetram.com>

Junte-se a nós no Discord &ndash; <https://discord.gg/MmbGAaw>

![Demo 1](https://i.imgur.com/PJdVts7.png)

![Demo 2](https://i.imgur.com/fmpcLhK.png)

![Demo 3](https://i.imgur.com/tQxib9S.png)

![Demo 4](https://i.imgur.com/Vlb3z8W.png)

![Demo 5](https://i.imgur.com/Fhvrw2S.png)

![Demo 6](https://i.imgur.com/eiK6wcr.png)

![Demo 7](https://i.imgur.com/C7cZsuf.png)

## Tecnologias

O BQ foi inicialmente escrito como um experimento HTML5 demonstrando as capacidades das tecnologias web em 2012. Kaetram se baseia nessa ideia e usa padrões modernos para ajudar a facilitar legibilidade, desempenho e compatibilidade. Alguns dos muitos recursos são:

- Multiplayer usando µWebSockets
- Motor de renderização aprimorado (inclui iluminação dinâmica, overlays, tiles animados)
- Sistema de região/chunks (cliente armazena em cache e salva dados do servidor conforme necessário)
  - Tiles dinâmicos (tiles que mudam dependendo do progresso do jogador em conquistas/missões/etc)
  - Objetos globais (tiles como árvores (e mais no futuro) com os quais o jogador pode interagir)
- Comércio entre jogadores
- Sistema de guilda com chat e suporte multi-mundo
- Sistema de encantamento para armas
- Sistema de missões e conquistas
- Sistema de habilidades
- Sistema de estilos de ataque
- Sistema de minigames para eventos especiais no jogo
- Comportamento de mobs baseado em plugins (usado para mobs especiais como chefes)
- Interação de itens baseada em plugins
- Sistema de hub para comunicação/sincronização entre servidores (mensagens privadas, mensagens globais)
- Integração com servidor Discord (jogo e servidor discord podem se comunicar entre si)
- Análise de mapa aprimorada c/ suporte para tilemaps compactados
- Yarn v3 com workspaces para empacotamento monorepo
- Sincronização de jogadores entre servidores (listas de amigos, guildas, status de login)
- Placar de líderes no jogo usando API REST

## Primeiros Passos

### Pré-requisitos

Você deve primeiro [instalar Node.js](https://nodejs.org/en/download) para executar o projeto, e _opcionalmente_ [instalar MongoDB](https://www.mongodb.com/try/download/community) para armazenar dados dos usuários no servidor.

#### NOTA: Node.js

> Você precisa usar uma versão do Node.js maior ou igual a `v16.17.1`, seguindo o [cronograma de Suporte de Longo Prazo (LTS)](https://nodejs.org/en/about/releases), para ter a experiência mais estável ao desenvolver/experimentar com Kaetram. Versões mais antigas não funcionarão com nossas dependências e gerenciador de pacotes atuais.

#### NOTA: MongoDB

> MongoDB não é um requisito para o Kaetram funcionar, mas você pode armazenar e salvar dados do usuário se você instalá-lo e executar um ambiente online com todos os recursos habilitados. Para fazer isso, veja [Configuração](#configuration), e defina `SKIP_DATABASE=false`. _Se você escolher instalar MongoDB, um usuário não é necessário, mas você pode habilitar autenticação com a configuração `MONGODB_AUTH`._

#### Yarn

Você também precisará habilitar o [Yarn](https://yarnpkg.com) através do [Corepack](https://nodejs.org/dist/latest/docs/api/corepack.html), para gerenciar as dependências.

> A maneira preferida de gerenciar o Yarn é através do [Corepack](https://nodejs.org/dist/latest/docs/api/corepack.html), um novo binário enviado com todas as versões do Node.js [...]
>
> Para habilitá-lo, execute o seguinte comando:
>
>
> corepack enable
>
>
> <https://yarnpkg.com/getting-started/install>

### Instalando

Instale as dependências simplesmente executando

```console
yarn
```

### Executando

_Você DEVE aceitar o acordo de licenciamento MPL2.0 e OPL alternando `ACCEPT_LICENSE` no arquivo de variável de ambiente. O servidor e cliente estão desativados até que você faça isso._

Para executar builds de desenvolvimento ao vivo, use

```console
yarn dev
```

Para criar builds de produção, execute

```console
yarn build
```

Then, to run each production build, use

```console
yarn start
```

### Configuração

Opcionalmente, se você deseja alguma configuração adicional, existe um arquivo chamado [`.env.defaults`](.env.defaults), e seus valores serão usados a menos que sejam substituídos por um novo arquivo `.env`.

Copie e renomeie [`.env.defaults`](.env.defaults) para `.env`, e modifique o conteúdo para atender às suas necessidades.

_Tenha em mente_, você precisa reconstruir o cliente e reiniciar o servidor toda vez que alterar sua configuração.

## Testes

### End to End

Como um [pré-requisito](#pré-requisitos) para executar os testes E2E, você também precisa de um servidor MongoDB em execução.

[Configuração](#configuração) para ambientes apenas de teste pode ser configurada em [`.env.e2e`](`.env.e2e`). Todos os seus valores voltarão para `.env`, depois para [`.env.defaults`](.env.defaults), se presentes.

Para executar testes em seu console, use

```console
yarn test:run
```

Alternativamente, se você quiser ter o ambiente de teste aberto interativamente, para que você possa selecionar o teste que deseja executar em uma interface de usuário, use

```console
yarn test:open
```

## Funcionalidades

### Regiões

O sistema de regiões funciona segmentando o mapa em pedaços menores que são então enviados ao cliente. O cliente armazena
os dados do mapa em cache e os guarda para um carregamento mais rápido no armazenamento local. Quando uma nova versão do mapa está presente, o cliente
limpa o cache e inicia o processo novamente. O sistema de regiões é dividido em blocos estáticos e blocos dinâmicos. Blocos estáticos
não sofrem alterações e são parte permanente do mapa. Blocos dinâmicos mudam dependendo de condições como
o progresso de conquistas/missões do jogador ou, no caso de árvores, dependendo se a árvore foi cortada ou não.
No futuro, planejamos usar este sistema de regiões para criar versões instanciadas de áreas, por exemplo, executando várias instâncias
de minigames ao mesmo tempo.

Exemplo em vídeo mostrando o sistema de regiões usando um exemplo exagerado:
[![Sistema de Regiões do Kaetram](https://img.youtube.com/vi/pt_CEgjfORE/0.jpg)](https://www.youtube.com/watch?v=pt_CEgjfORE)

### Tilemap

Kaetram usa o [Tiled Map Editor](https://www.mapeditor.org/) para criar e modificar o mapa. Nossa ferramenta de [análise de mapa](#map-parsing)
é usada para exportar uma versão condensada dos dados do mapa. O servidor recebe a maior parte das informações e as usa para calcular
colisões, informações de dados de tiles e áreas (pvp, música, etc). O cliente armazena dados mínimos como 'z-index' dos tiles e animações.

### Análise do Mapa

Depois de terminar de modificar seu mapa em [`packages/tools/map/data/`](packages/tools/map/data/), você pode
analisar os dados do mapa executando `yarn exportmap` dentro do diretório [`packages/tools/`](packages/tools/).

Exemplo de comando:

```console
yarn exportmap ./data/map.json
```

Para construir o mapa atual do jogo, você pode executar

```console
yarn map
```

### Hub Kaetram

O hub funciona como um gateway entre servidores. Devido às limitações de desempenho do NodeJS, é mais viável
hospedar vários servidores em vez de um único grande servidor contendo milhares de jogadores. O hub faz exatamente isso, uma vez que
o hub está em execução e uma instância do servidor recebe o endereço do host para o hub, ele se conectará automaticamente. O
hub se torna o ponto de conexão principal para o cliente. Quando uma solicitação de conexão é recebida, o hub
escolherá o primeiro servidor que tiver espaço para o jogador. Alternativamente, permite que os jogadores selecionem qualquer servidor
entre a lista de servidores.

Para habilitar o servidor hub, veja [Configuração](#configuration), e defina estes valores como `true`.

```sh
API_ENABLED=true
HUB_ENABLED=true
```

## Roteiro

Aqui temos [O Quadro do Roteiro do Projeto](https://github.com/Kaetram/Kaetram-Open/projects/1). Este
é o quadro principal do projeto Kaetram-Open. Um tipo de quadro Kanban de tarefas para acompanhar e
apresentar o progresso para a comunidade. Aqui nós planejamos, priorizamos e acompanhamos nosso trabalho.

Veja também as [issues abertas][issues] para uma lista de funcionalidades propostas (e problemas conhecidos).

### A FAZER

- Adicionar ataques especiais às armas
- Adicionar funcionalidade às habilidades especiais
- Encantamentos de armas/armaduras/anéis/pingentes
- Diversificar conteúdo do jogo (adicionar mais habilidades, minigames, atividades, itens, etc)
- Melhorar a usabilidade da interface do usuário em dispositivos móveis
- Mover o sistema de pathfinding para o lado do servidor após o término da fase alfa

## Doações

### Patrocínio

Patreon – <https://www.patreon.com/kaetram>

Open Collective – <https://opencollective.com/kaetram>

### Crypto

`BTC` &ndash; `bc1qeh0tdlkuc5q82j2qk9h3sqmwe6uy75qpjtc0dv`

`LTC` &ndash; `MMRo7dfAi2T8rJrx7m3DmzhsgHRC7XJ83f`

`ETH` &ndash; `0x4c6de7175f789DAf0f531477753B07402EEfedaC`

`BCH` &ndash; `bitcoincash:qzx6uqunqj4mtv74jng97pea0mfcl4nmyqsew92enu`

## Licença & Comissão

Após o lançamento da versão beta, o Kaetram-Open será atualizado apenas uma vez a cada 2-4 semanas. Não haverá mais atualizações na arte dos sprites, música, propriedades de itens/mobs/npcs/etc. Este repositório fornecerá as ferramentas necessárias para criar sua própria versão do Kaetram, existem muitos recursos incluídos para isso. Modificações futuras consistirão principalmente em melhorias no motor do jogo.

Para todas as consultas sobre a compra de uma licença diferente, trabalho comissionado ou compra de acesso à nossa versão atualizada, entre em contato com **@kaetram** no [Discord][discord] ou envie um e-mail para <admin@kaetram.com>.

Este projeto é distribuído sob a **[Licença Pública Mozilla Versão 2.0](https://choosealicense.com/licenses/mpl-2.0/)**. Veja [`LICENSE`][license] para mais informações.

Além disso, o Kaetram é distribuído com uma licença secundária, a Licença Pública Omnia (OPL):

- Você DEVE fornecer um link direto para o Kaetram na seção de créditos.
- Você DEVE manter o código open-source e continuar fazendo isso.
- Você NÃO PODE usar este projeto ou qualquer parte dele para qualquer coisa relacionada a inteligência artificial, criptomoedas ou NFTs sem permissão direta dos criadores.
- Você NÃO PODE remover a seção de créditos. Ela DEVE permanecer visível na página inicial do site. Ela DEVE ser facilmente acessível a qualquer usuário que acesse o projeto conforme os [Padrões de Acessibilidade W3C](https://www.w3.org/WAI/standards-guidelines/).
- Você NÃO PODE remover quaisquer créditos aos artistas, músicos ou quaisquer outros criadores originais deste projeto.
- Você NÃO PODE usar este projeto ou qualquer parte dele para vender cursos online, no entanto, você pode usar isso para plataformas gerais de streaming, incluindo receita baseada em visualizações.
- Você NÃO PODE usar este projeto ou qualquer parte dele para qualquer atividade ilícita.
- Você NÃO PODE usar este projeto ou qualquer parte dele para espalhar ódio, racismo ou qualquer forma de comportamento discriminatório.

Se você tiver alguma dúvida, entre em contato com @kaetram no [Discord][discord].

[license]: LICENSE 'Licença do Projeto'
[issues]: https://github.com/Kaetram/Kaetram-Open/issues 'Issues Abertas'
[discord]: https://discord.gg/MmbGAaw 'Entre no Discord'
