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

---

## Decision
Implementar áudio de passos e fallback de música do tutorial exclusivamente no cliente, reutilizando o fluxo de música existente e a malha de movimento já presente.

## Reason
Os hooks de passo e o controlador de áudio já existem no cliente. O tutorial não recebe área de música do servidor na posição inicial, então a forma menos invasiva é manter o protocolo atual para o mundo aberto e ativar no cliente uma música de fallback enquanto a quest de tutorial estiver ativa e nenhuma música de área tiver sido definida.

## Consequences
- Sons de passo são disparados no `player/handler`, sem criar sistema paralelo de movimento.
- A escolha entre passo comum e passo em grama usa inspeção local dos tiles da célula atual no cliente.
- O fallback do tutorial não altera o comportamento existente de músicas enviadas pelo servidor; ele só preenche a ausência inicial de música durante o tutorial.

---

## Decision
Trocar os passos do player local de disparos one-shot por um canal em loop controlado pelo estado de caminhada, com ganho dedicado acima do volume base de SFX.

## Reason
O disparo a cada dois tiles deixava grandes intervalos e baixa percepção frente à música de fundo. Um loop único enquanto `moving` estiver ativo mantém o som contínuo, permite parada imediata em idle e preserva a troca de asset quando o piso muda entre chão comum e grama alta.

## Consequences
- `packages/client/src/controllers/audio.ts` mantém um source em loop exclusivo para passos e o interrompe quando o movimento termina ou o áudio é desativado.
- `packages/client/src/entity/character/player/handler.ts` passa a sincronizar início, atualização de superfície e parada dos passos com o estado local de caminhada.
- O ganho de passos usa multiplicador dedicado sobre `soundVolume` para ficar audível e aplica ducking leve na música apenas enquanto o loop de passos estiver ativo.

---

## Decision
Aplicar ducking leve e temporário na música de fundo enquanto o loop de passos do player local estiver ativo.

## Reason
O ganho dedicado dos passos melhorou a presença do canal, mas ainda não abriu espaço suficiente na mix quando a música está tocando. O ajuste mínimo é reduzir discretamente a música apenas durante o loop ativo, sem alterar os demais SFX nem o fluxo existente de reprodução.

## Consequences
- `packages/client/src/controllers/audio.ts` reduz levemente o ganho efetivo da música ao iniciar passos e restaura ao parar.
- O ducking não interfere no comportamento dos demais SFX one-shot, que continuam usando `playSound()`.
- Alterações no volume de SFX passam a refletir imediatamente nos passos em loop via `audio.updateVolume()` no menu de settings.

---

## Decision
Normalizar o starter set no login com anti-duplicidade por item, usando inventário e equipamentos já carregados antes de marcar ou completar contas legadas sem `starterSetReceived`.

## Reason
A checagem anterior só reconhecia evidência quando as cinco peças estavam presentes ao mesmo tempo. Isso duplicava peças em contas legadas com evidência parcial e não distinguia corretamente entre personagem já marcado, legado com parte do set e legado sem nenhuma evidência. A correção mínima e segura é usar o marcador histórico como fonte de não reentrega e, para contas sem marcador, completar apenas os itens ausentes entre inventário e equipamentos.

## Consequences
- `packages/server/src/game/entity/character/player/player.ts` normaliza o starter set somente depois que inventário, equipamentos e estatísticas tiverem sido carregados.
- Personagem com `starterSetReceived = true` nunca recebe reentrega automática, mesmo se tiver vendido, descartado ou removido peças depois.
- Conta legada sem marcador e com evidência parcial ou total do starter set passa a receber somente as peças faltantes, sem duplicar as que já existem no inventário ou nos equipamentos.
- Conta legada sem marcador e sem nenhuma evidência continua recebendo o set completo uma única vez no login.
- A migração permanece baseada no estado atual e no marcador persistido, sem criar histórico paralelo novo.
