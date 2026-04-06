# Architecture

## Architecture Style
Monorepo modular com workspaces, separando aplicações, bibliotecas compartilhadas, ferramentas de build e ativos do jogo.

## Core Components
- Root workspace: coordena workspaces, aliases TypeScript, scripts de desenvolvimento e orquestração.
- `packages/common`: contrato compartilhado entre cliente, servidor, hub, admin, ferramentas e testes.
- `packages/client`: aplicação Astro/TypeScript do cliente do jogo.
- `packages/server`: runtime principal do jogo, regras de domínio, rede e dados.
- `packages/hub`: serviços auxiliares e integração administrativa.
- `packages/admin`: interface administrativa.
- `packages/tools`: utilitários de parsing, exportação e suporte operacional.
- `packages/e2e`: suíte de testes ponta a ponta e fixtures.

## Data Flow
- O cliente consome contratos, tipos, i18n e protocolos publicados por `packages/common`.
- Servidor, hub, admin, tools e e2e também dependem de `packages/common` para manter o protocolo compartilhado.
- O workspace root define aliases TypeScript e nomes de pacote que permitem importações internas entre workspaces.
- Docker, scripts Yarn e configuração de build resolvem workspaces pelo nome dos pacotes publicados no monorepo.

## Key Design Principles
- `packages/common` é a fonte única de contratos compartilhados.
- O rebranding de namespace deve preservar comportamento e compatibilidade interna antes de alterar naming externo adicional.
- A migração de `@kaetram/*` para `@acacia/*` deve ser executada de forma coesa em manifests, aliases TypeScript, imports, scripts e automações.
- A remoção de referências Kaetram deve considerar também textos, URLs, nomes de workspace, comandos Docker, testes e documentação.
- Refatorações de branding devem ser divididas em duas frentes: namespace técnico de pacotes e referências textuais/produto.

## Current Rebranding Direction
A workspace está em transição de branding técnico. O objetivo arquitetural é substituir a namespace interna `@kaetram` por `@acacia`, além de remover gradualmente referências residuais ao nome Kaetram em documentação, configuração, assets textuais e fluxos operacionais.

## Rebranding Migration Boundaries
- Fase 1: renomear o root package, aliases TypeScript e todos os nomes de workspace para `@acacia/*` ou `acacia` no root.
- Fase 2: atualizar imports internos e referências de scripts para a nova namespace.
- Fase 3: eliminar referências textuais Kaetram em documentação, mensagens, URLs configuráveis e artefatos visíveis ao usuário.
- Fase 4: validar build, testes e runtime após a substituição completa.

## Compatibility Notes
Como o monorepo usa imports internos extensivos por nome de pacote, a mudança de namespace deve ser aplicada como operação atômica por camada. Não é seguro misturar pacotes `@kaetram/*` e `@acacia/*` por longos períodos sem uma estratégia explícita de compatibilidade temporária.
