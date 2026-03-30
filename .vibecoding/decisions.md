# Architectural Decisions

## Decision
Adotar `@acacia` como namespace oficial dos workspaces internos e remover gradualmente referências técnicas e textuais a Kaetram dentro da workspace.

## Reason
O projeto precisa deixar de depender da identidade anterior para permitir evolução como distribuição própria, reduzindo acoplamento de marca em código, documentação, scripts, Docker, testes e comunicação com usuário.

## Consequences
- Todos os manifests, aliases, imports e scripts dependentes de nome de pacote precisam ser atualizados de forma consistente.
- A validação deve incluir busca textual ampla, não apenas compilação.
- Mudanças de branding visível ao usuário podem exigir revisão adicional de conteúdo e URLs.

---

## Decision
Executar a migração em fases, começando por namespace técnico de pacotes antes da limpeza de branding textual.

## Reason
A maior superfície de risco está na resolução interna do monorepo. Corrigir primeiro nomes de pacote, aliases TypeScript e imports reduz a chance de falhas estruturais e simplifica a validação posterior.

## Consequences
- A implementação deve priorizar `package.json`, `tsconfig.json`, imports e automações.
- A remoção de textos Kaetram em README, e-mails, links e assets deve ocorrer depois da estabilidade técnica.
- Pode existir uma janela curta de migração com branding textual legado, mas não deve permanecer após a conclusão do trabalho.

---

## Decision
Tratar referências Kaetram em três categorias: identidade técnica, branding textual e conteúdo de domínio.

## Reason
Nem toda ocorrência do termo Kaetram representa namespace de pacote. Algumas são branding removível; outras podem estar em dados do jogo e precisam de decisão consciente antes de substituição cega.

## Consequences
- Ocorrências em imports, nomes de pacote e scripts devem ser migradas obrigatoriamente.
- Ocorrências em documentação, e-mails, URLs e mensagens devem ser revisadas como branding.
- Ocorrências em assets, chaves de dados e conteúdo narrativo devem ser avaliadas caso a caso para evitar quebrar compatibilidade ou alterar domínio sem intenção explícita.

---

## Decision
Usar busca residual por `kaetram` e `@kaetram` como critério de aceite arquitetural ao final da refatoração.

## Reason
O objetivo declarado é eliminar qualquer referência ao projeto anterior na workspace. Compilação verde sozinha não garante que o rebranding foi concluído.

## Consequences
- O fluxo de implementação deve terminar com auditoria textual completa.
- Exceções, se existirem, precisam ser registradas explicitamente no contexto.
- Testes de build e runtime continuam obrigatórios para confirmar que a troca de namespace não rompeu a integração interna.

---

## Decision
Adotar estratégia de volumes para separação de ambientes Docker, com cada docker-compose.yml usando seu arquivo .env específico e volumes para materializar como .env dentro dos containers.

## Reason
Manter isolamento claro de configurações por ambiente (development vs multiworld) sem modificar Dockerfiles compartilhados, respeitando convenções de nome e mantendo precedência clara de variáveis.

## Consequences
- docker/docker-compose.yml usa ../.env.defaults via volume
- docker-multiworld/docker-compose.yml usa ../.env.multiworld via volume
- environment no compose sobrescreve env_file (precedência mantida)
- Dockerfiles permanecem genéricos e compartilhados
- Não executar ambos os compose simultaneamente (mesma rede pode causar conflitos)
