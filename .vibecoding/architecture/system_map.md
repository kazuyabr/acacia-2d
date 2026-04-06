# System Map

## Modules
- Root workspace
- `packages/common`
- `packages/client`
- `packages/server`
- `packages/hub`
- `packages/admin`
- `packages/tools`
- `packages/e2e`
- Infraestrutura Docker
- Documentação e contexto `.vibecoding`

## Responsibilities
- Root workspace: define workspaces, scripts globais, aliases TypeScript e coordenação do monorepo.
- `packages/common`: concentra tipos, protocolos de rede, utilitários, configuração compartilhada e contratos consumidos pelos demais módulos.
- `packages/client`: entrega a interface jogável e integra renderização, rede, menus e assets.
- `packages/server`: executa a lógica principal do jogo, mundo, entidades, mapas e comunicação de runtime.
- `packages/hub`: provê serviços auxiliares, integrações administrativas, API e coordenação entre serviços.
- `packages/admin`: expõe a interface administrativa baseada em Astro.
- `packages/tools`: fornece parsers, exportadores e utilitários operacionais.
- `packages/e2e`: valida fluxos ponta a ponta com fixtures e infraestrutura de teste.
- Infraestrutura Docker: sobe serviços principais por comandos Yarn baseados em nome de workspace.
- Contexto `.vibecoding`: registra decisões, arquitetura e restrições do sistema.

## Interactions
- Todos os módulos de aplicação dependem de `packages/common` por imports de namespace de workspace.
- O root workspace e o `tsconfig.json` definem como os aliases internos são resolvidos no build e no desenvolvimento.
- `docker/docker-compose.yml`, manifests `package.json` e `yarn.lock` dependem do nome dos workspaces para subir os serviços corretos.
- Os testes em `packages/e2e` acionam scripts do workspace root e verificam a saúde dos serviços publicados.
- A documentação e o contexto devem refletir mudanças estruturais de naming para evitar divergência entre arquitetura e implementação.

## Rebranding Impact Map
### Camada 1: Identidade de pacote
- `package.json` root
- `packages/*/package.json`
- `tsconfig.json`
- `yarn.lock`

### Camada 2: Resolução interna
- imports `@kaetram/*` em cliente, servidor, hub, admin, common, tools e e2e
- referências ao pacote root `kaetram` em scripts de execução
- comandos Docker e automação Yarn

### Camada 3: Branding textual
- `README.md`
- textos de UI, e-mails e mensagens do sistema
- URLs, handles e referências públicas ao projeto Kaetram
- dados e conteúdos nomeados com Kaetram quando representam branding e não domínio fixo

### Camada 4: Validação
- build por workspace
- testes e2e
- fluxo Docker
- inspeção final por busca de ocorrências residuais de `kaetram` e `@kaetram`

## Migration Rule
A migração deve acontecer do centro para as bordas: primeiro identidade de pacote e resolução técnica, depois referências textuais e públicas. Isso reduz quebra de resolução de imports e facilita validação incremental.
