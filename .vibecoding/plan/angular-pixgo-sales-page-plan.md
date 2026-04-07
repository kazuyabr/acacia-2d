# Objetivo

Produzir um plano estruturado para criar uma página web de venda de itens com pagamento via PIX por QR Code, avaliando integração com PixGo para recebimento de PIX convertido em cripto, sem implementar código e distinguindo explicitamente fatos confirmados no repositório de hipóteses.

---

# Resumo executivo

O repositório **não usa Angular hoje**. O frontend confirmado é baseado principalmente em Astro no cliente e no admin, com backend de apoio em Express no hub. Existe também evidência de uma integração de pagamentos anterior/incompleta com Stripe no hub, o que indica um ponto natural para futuras integrações de cobrança e webhook.

Para a página de vendas, a opção arquitetural mais consistente com o estado atual é **não introduzir Angular como primeira escolha**. A melhor trilha inicial é criar a página de vendas dentro do frontend já existente em [`packages/client/package.json`](packages/client/package.json) ou, se houver necessidade forte de isolamento, em um app separado e desacoplado do runtime do jogo. Angular integrado ao frontend atual é a alternativa de maior custo e maior risco de complexidade operacional no monorepo.

A fonte de verdade mais confiável para “itens” já existentes no produto está em [`packages/server/data/items.json`](packages/server/data/items.json) e, para itens já comercializados no jogo, em [`packages/server/data/stores.json`](packages/server/data/stores.json). O arquivo [`item_planning_file.md`](item_planning_file.md) contém planejamento de itens futuros, mas não deve ser tratado como catálogo pronto para venda externa sem curadoria de produto.

A integração com PixGo **não pôde ser confirmada por documentação oficial dentro do repositório nem via fonte de docs conectada**. Portanto, a viabilidade é apenas **condicional**: o plano assume um provedor PIX com API para criação de cobrança, retorno de payload/QR Code e webhook de confirmação. Se PixGo suportar additionally a conversão para cripto após liquidação, ele pode ocupar esse papel; caso contrário, será necessário um arranjo híbrido com outro PSP/bridge.

---

# Contexto

## Confirmado no repositório

- O monorepo segue arquitetura modular com workspaces, conforme [`package.json`](package.json) e [` .vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md).
- O frontend principal atual é Astro em [`packages/client/package.json`](packages/client/package.json) e [`packages/client/pages/index.astro`](packages/client/pages/index.astro).
- O admin também usa Astro em [`packages/admin/package.json`](packages/admin/package.json) e [`packages/admin/pages/index.astro`](packages/admin/pages/index.astro).
- O hub usa Express/TypeScript em [`packages/hub/package.json`](packages/hub/package.json) e expõe rotas HTTP em [`packages/hub/src/controllers/api.ts`](packages/hub/src/controllers/api.ts).
- Já existe um ponto de integração de pagamento legado/incompleto para Stripe em [`packages/hub/src/controllers/api.ts`](packages/hub/src/controllers/api.ts), incluindo endpoint de webhook e validação de assinatura.
- O cliente possui integração com i18n, SEO, PWA e pipeline Astro/Vite em [`packages/client/astro.config.ts`](packages/client/astro.config.ts) e [`packages/client/layouts/default.astro`](packages/client/layouts/default.astro).
- A direção arquitetural vigente enfatiza workspaces coesos, contratos compartilhados em [`packages/common`](packages/common/) e evolução incremental, conforme [` .vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md) e [` .vibecoding/architecture/system_map.md`](.vibecoding/architecture/system_map.md).

## Hipóteses necessárias para este plano

- O objetivo da “página de vendas” é vender itens digitais do jogo para uma audiência externa ao runtime do cliente jogável.
- A entrega do item ocorrerá por associação a conta/personagem e não por envio manual fora do sistema.
- A futura integração PixGo, se aprovada, oferecerá recursos equivalentes a: criação de cobrança PIX, retorno de QR Code/EMV, consulta de status e webhook de liquidação.
- O recebimento “PIX convertido em cripto” será operacionalizado pelo provedor de pagamento, e não pelo repositório diretamente.

## Ambiguidades críticas registradas

- Não há confirmação no repositório sobre qual item pode ser vendido com segurança do ponto de vista de produto, balanceamento, licenciamento e monetização.
- Não há confirmação de documentação oficial, credenciais, SLA, requisitos de compliance nem modelo de autenticação da PixGo.
- Não há evidência de um módulo atual de “ordens/pedidos” persistidos para pagamentos externos.

---

# Decisões aplicadas

- Respeitar [`packages/common`](packages/common/) como ponto natural para contratos compartilhados entre frontend, hub e eventual módulo de checkout, conforme [` .vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md).
- Preservar a stack atual antes de introduzir nova stack frontend, coerente com a direção de mudanças incrementais registrada em [` .vibecoding/plan/multiworld-scalable-current-context.md`](.vibecoding/plan/multiworld-scalable-current-context.md).
- Tratar a integração de pagamentos como responsabilidade de backend/hub, nunca apenas do frontend, por exigir assinatura, segredo, webhook, conciliação e rastreabilidade.
- Separar claramente “catálogo vendável” de “todos os itens existentes no jogo”; nem todo item existente deve virar item comercial.
- Marcar explicitamente tudo o que depende de documentação oficial da PixGo como hipótese pendente.

---

# Inventário dos itens encontrados ou fontes de verdade para itens

## 1. Fonte primária confirmada de itens do jogo

- [`packages/server/data/items.json`](packages/server/data/items.json)
  - Contém o catálogo bruto de itens do jogo com atributos como `type`, `name`, `description`, requisitos, stats e comportamentos.
  - É a fonte mais forte para identificar itens reais existentes.

### Exemplos confirmados

- armas e equipamentos no início de [`packages/server/data/items.json`](packages/server/data/items.json)
- item monetário interno `token` em [`packages/server/data/items.json`](packages/server/data/items.json)

## 2. Fonte confirmada de itens já comercializados internamente no jogo

- [`packages/server/data/stores.json`](packages/server/data/stores.json)
  - Define lojas do jogo e subconjuntos de itens com `price`, `count`, `currency`, `refresh` e restrições.
  - É a melhor pista de itens com precedência econômica já existente.

### Conjuntos com maior potencial de venda externa

- Loja `cosmetics` em [`packages/server/data/stores.json`](packages/server/data/stores.json)
  - Itens confirmados: `lolipop`, `spoon`, `cellobello`, `taekwondo`, `danbo`, `danboblue`, `danbogreen`, `danbored`, `ratpet`, `rathatpet`
  - Indício forte de catálogo premium/cosmético, pois usa moeda `token` e loja `restricted`.

### Outros conjuntos confirmados, mas sensíveis para monetização

- `startshop`, `forester`, `sorcerer`, `miner`, `ingredientsstore`, `fishingstore` em [`packages/server/data/stores.json`](packages/server/data/stores.json)
- Esses itens existem e têm preço no jogo, mas vender externamente armas, recursos ou progressão exige validação de produto para evitar pay-to-win e conflito de balanceamento.

## 3. Fontes secundárias de planejamento, não tratadas como catálogo confirmado

- [`item_planning_file.md`](item_planning_file.md)
  - Lista materiais, alimentos, metais, gemas e estruturas conceituais.
  - Deve ser tratada como backlog de design, não como catálogo operacional de checkout.

## Conclusão do inventário

### Confirmado

- Há muitos itens reais no jogo.
- Há um subconjunto explícito de itens economicamente organizados em lojas.
- Há uma loja cosmética especialmente promissora para monetização externa.

### Hipótese recomendada

- A primeira versão da página de vendas deve focar **apenas em itens cosméticos e/ou tokens premium controlados**, evitando vender itens que afetem progressão sem decisão explícita de produto.

---

# Avaliação arquitetural para uso de Angular

## Estado atual do frontend

### Confirmado

- O frontend principal é Astro em [`packages/client/package.json`](packages/client/package.json).
- A home atual renderiza componentes Astro em [`packages/client/pages/index.astro`](packages/client/pages/index.astro).
- O admin também é Astro em [`packages/admin/package.json`](packages/admin/package.json).
- Não há dependências `@angular/*` confirmadas no monorepo.
- O cliente atual já possui pipeline de build, i18n, SEO e PWA em [`packages/client/astro.config.ts`](packages/client/astro.config.ts).

## Impacto de introduzir Angular

### Riscos confirmáveis pela arquitetura atual

- Adição de uma segunda stack SPA pesada no monorepo aumenta custo de build, lint, padronização e onboarding.
- A stack Astro atual já resolve páginas web, SEO e composição de layout; portanto Angular não atende uma lacuna técnica evidente no repositório.
- Introduzir Angular dentro do mesmo frontend exigiria decisão explícita sobre roteamento, deploy, assets, autenticação e compartilhamento de contratos.

## Opção A — Angular isolado como app separado

### Descrição

Criar um novo workspace dedicado, por exemplo `packages/storefront-angular`, com ciclo de build e deploy separado da app Astro principal.

### Vantagens

- Isola impacto técnico e dependências de Angular.
- Permite time separado, design system próprio e deploy independente.
- Evita acoplar o runtime do jogo e a página de vendas.

### Desvantagens

- Duplica infraestrutura frontend.
- Exige estratégia adicional de autenticação/SSO e de compartilhamento visual/SEO.
- Aumenta custo operacional no monorepo.

### Quando usar

- Se houver exigência organizacional explícita por Angular.
- Se a página de vendas evoluir para um produto comercial mais amplo e independente do jogo.

### Avaliação

- **Viável**, porém não é a opção preferencial para a primeira entrega.

## Opção B — Angular integrado ao frontend atual

### Descrição

Embutir Angular no frontend existente, usando Astro como shell ou coexistência de rotas.

### Vantagens

- Reaproveita domínio, host e parte da entrega web.

### Desvantagens

- Maior complexidade de integração entre frameworks.
- Risco de conflito com pipeline Astro/Vite atual.
- Pode degradar simplicidade arquitetural sem benefício claro.

### Avaliação

- **Tecnicamente possível, mas desaconselhado** para a fase inicial.

## Opção C — Alternativa sem Angular, dentro da stack atual

### Descrição

Construir a página de vendas no frontend Astro atual, usando páginas e componentes dedicados e delegando pagamento ao hub/API.

### Vantagens

- Menor risco arquitetural.
- Maior aderência ao repositório existente.
- Reaproveita SEO, layout, i18n, domínio e infraestrutura atual.
- Menor lead time para MVP.

### Desvantagens

- Não atende preferência por Angular se ela for mandatória e não apenas desejável.

### Avaliação

- **Opção preferencial** para MVP e para validação do fluxo de venda.

## Recomendação arquitetural

1. **Preferência 1:** página de vendas na stack atual do cliente Astro.
2. **Preferência 2:** app Angular separado, se Angular for requisito não negociável.
3. **Evitar:** Angular misturado ao frontend atual na primeira iteração.

---

# Fluxo funcional da venda com PIX QR Code

## Fluxo alvo de alto nível

1. visitante acessa a página de vendas
2. sistema exibe catálogo vendável
3. visitante escolhe item único ou itens do carrinho
4. frontend solicita criação de pedido ao backend
5. backend valida catálogo/preço e cria ordem pendente
6. backend solicita cobrança PIX ao provedor
7. backend retorna payload de cobrança, QR Code e prazo
8. frontend exibe resumo + QR Code + código copiável
9. provedor confirma pagamento via webhook ou consulta de status
10. backend reconcilia pagamento, marca pedido como pago e dispara entrega
11. sistema entrega/libera item
12. frontend mostra confirmação final e histórico/status

## Modelos de compra

### Opção recomendada para MVP

- **Compra direta de um item por vez**
- Reduz complexidade de carrinho, cálculo de totais e reconciliação parcial.

### Opção evolutiva

- **Carrinho simples** com múltiplos itens apenas após validar pedido unitário, webhook e entrega.

## Componentes funcionais necessários

### Catálogo

- lista de SKUs vendáveis
- nome, descrição, imagem, preço BRL
- tipo de entrega: token, cosmético, item, pacote
- disponibilidade por ambiente/realm, se aplicável

### Checkout

- identificação do comprador/conta
- resumo do pedido
- criação da cobrança PIX

### Cobrança PIX

- valor
- id externo do pedido
- QR Code renderizável
- payload copia-e-cola
- expiração
- status: pendente, pago, expirado, falhou

### Confirmação

- webhook como fonte primária
- polling/control plane apenas como fallback

### Entrega/liberação

- crédito na conta offline ou entrega em login futuro
- prevenção de entrega duplicada
- trilha de auditoria por pedido

## Pontos de decisão de produto

### Confirmado como lacuna

- O repositório não define ainda uma política de entrega para compras externas.

### Hipóteses de entrega possíveis

- creditar moeda premium interna
- liberar item cosmético diretamente na conta
- registrar entitlement e permitir resgate in-game

### Recomendação

- Para o primeiro corte, entregar **entitlement persistido + job/idempotência de concessão**, em vez de mutação ad-hoc do inventário.

---

# Estratégia de integração com PixGo

## Nível de confirmação atual

### Confirmado

- Não existe integração PixGo no repositório.
- Não foi encontrada documentação oficial da PixGo nas fontes disponíveis durante esta análise.
- Existe precedente de integração com provedor externo via webhook no hub, usando Stripe, em [`packages/hub/src/controllers/api.ts`](packages/hub/src/controllers/api.ts).

### Hipótese operacional

Se PixGo fornecer API compatível com PSP PIX, a integração pode seguir o mesmo padrão estrutural:

1. backend cria pedido interno
2. backend chama API PixGo para criar cobrança
3. backend armazena `providerPaymentId` e payload retornado
4. frontend mostra QR Code
5. PixGo envia webhook de pagamento liquidado
6. backend valida autenticidade e atualiza pedido
7. backend dispara entrega do item

## Dados necessários para integrar

### Dados internos

- `orderId` interno
- `buyerAccountId` ou identificador equivalente
- SKU(s)
- valor total BRL
- ambiente/realm/channel, se necessário
- metadata de correlação

### Dados esperados do provedor

- `paymentId` externo
- status da cobrança
- valor líquido/bruto
- QR Code em imagem ou payload EMV
- vencimento
- identificador de transação
- assinatura do webhook ou segredo
- eventual confirmação de conversão para cripto

## Fluxo esperado de API/webhook

### API de criação de cobrança

- entrada: valor, descrição, referência interna, callback/webhook metadata
- saída: `paymentId`, `qrCodeText`, `qrCodeImage` opcional, `expiresAt`, `status`

### Webhook

- evento de pagamento confirmado/liquidado
- assinatura verificável
- id do pagamento
- status final
- valor recebido
- timestamps

### Consulta de status

- endpoint de backoffice para confirmar divergências ou reprocessar reconciliação

## Viabilidade técnica

### Condicionalmente viável

A integração é tecnicamente plausível **se** PixGo disponibilizar:

- API autenticada
- geração de cobrança PIX por QR Code
- webhook verificável
- documentação de status/erros
- suporte operacional para conversão em cripto ao recebedor

### Não confirmado

- formato de autenticação da PixGo
- suporte real a PIX estático/dinâmico
- SLA e política de webhook
- países/contas aceitas
- regras de KYC/AML
- como ocorre a conversão para cripto
- liquidação, fees e reversão

## Riscos específicos da PixGo

- Dependência de documentação externa não validada.
- Possível mismatch entre “receber PIX” e “receber cripto” no mesmo fluxo.
- Complexidade regulatória e financeira fora do escopo puramente técnico.
- Necessidade de credenciais e ambiente sandbox antes de qualquer implementação confiável.

## Decisão recomendada sobre PixGo

- Tratar PixGo como **provedor candidato**, não como decisão fechada.
- Planejar a integração por **porta de pagamento abstrata** no backend, para permitir trocar PixGo por outro PSP sem reescrever o checkout.

---

# Requisitos técnicos de frontend/backend

## Frontend

### Mínimos para MVP

- página de catálogo/checkout
- componentes de estado do pedido
- tela de QR Code PIX
- atualização de status por polling curto ou SSE/WebSocket futuro
- mensagens claras para pago/pendente/expirado

### Se usar Astro

- nova rota pública de vendas
- consumo de API do hub ou serviço dedicado
- reaproveitamento do layout atual quando conveniente

### Se usar Angular separado

- workspace próprio
- estratégia de deploy/host
- cliente HTTP para backend de pagamentos
- política de autenticação entre storefront e conta do jogo

## Backend

### Capacidades obrigatórias

- catálogo vendável curado e versionado
- criação de pedido interno
- integração com provedor de pagamento
- endpoint de webhook assinado
- consulta de status e painel mínimo operacional
- entrega do item com idempotência

### Modelo lógico mínimo sugerido

- `sellable_catalog`
- `orders`
- `order_items`
- `payment_attempts`
- `payment_events`
- `entitlements` ou `grants`

### Requisitos de entrega

- idempotência por `orderId` e `providerPaymentId`
- prevenção de crédito duplicado
- suporte a entrega offline
- trilha completa de auditoria

## Segurança

- Segredos do provedor apenas no backend.
- Verificação de assinatura do webhook.
- Catálogo e preços sempre confirmados no backend, nunca confiados do frontend.
- Rate limit em criação de cobrança e consulta de status.
- Proteção contra replay de webhook.
- Logs auditáveis sem expor segredos.

## Rastreabilidade e reconciliação

- Persistir payloads resumidos do provedor e eventos de mudança de status.
- Registrar timestamps de criação, expiração, pagamento e entrega.
- Permitir reprocessamento manual de pedidos pendentes/divergentes.
- Relacionar pedido interno, pagamento externo e concessão do item.

---

# Estratégia de implementação em baby steps

## Fase 0 — Descoberta e validação externa

Resultado verificável:

- documentação oficial da PixGo obtida
- credenciais sandbox confirmadas
- decisão de produto sobre quais SKUs podem ser vendidos

Passos:

1. validar oficialmente as capacidades da PixGo
2. definir o catálogo inicial vendável
3. decidir se Angular é requisito real ou preferência

## Fase 1 — Catálogo vendável interno

Resultado verificável:

- existe lista explícita de SKUs monetizáveis separada do catálogo total do jogo

Passos:

1. selecionar apenas SKUs aprovados
2. definir preços BRL e regras de entrega
3. definir se a fonte será derivada de [`packages/server/data/items.json`](packages/server/data/items.json) ou tabela própria de catálogo comercial

## Fase 2 — Modelo de pedidos

Resultado verificável:

- pedido pode ser criado internamente sem chamar PSP

Passos:

1. definir entidade de pedido
2. definir estados de pedido e pagamento
3. definir trilha de auditoria e idempotência

## Fase 3 — Página web de venda sem pagamento real

Resultado verificável:

- usuário navega catálogo, escolhe item e visualiza checkout mockado

Passos:

1. criar rota de storefront
2. integrar leitura do catálogo vendável
3. mostrar fluxo de compra direta

## Fase 4 — Integração do backend com provedor PIX

Resultado verificável:

- pedido gera cobrança PIX pendente com QR Code real em sandbox

Passos:

1. criar adaptador de provedor
2. implementar criação de cobrança
3. persistir referências externas e expiração

## Fase 5 — Webhook e reconciliação

Resultado verificável:

- pagamento em sandbox muda pedido para pago de forma automática

Passos:

1. implementar endpoint de webhook
2. validar assinatura
3. persistir eventos
4. atualizar pedido com idempotência

## Fase 6 — Entrega do item

Resultado verificável:

- pedido pago gera entitlement/concessão única

Passos:

1. definir mecanismo de concessão
2. impedir duplicidade
3. registrar trilha de entrega

## Fase 7 — Operação e observabilidade

Resultado verificável:

- equipe consegue auditar pedidos, pagamentos e falhas

Passos:

1. criar consultas operacionais
2. definir alertas e logs mínimos
3. documentar runbooks de reconciliação

---

# Riscos

## Técnicos

- Introdução de Angular aumentar complexidade sem necessidade prática.
- Mistura de stacks frontend no mesmo produto gerar sobrecarga operacional.
- Acoplamento indevido entre runtime do jogo e checkout externo.
- Entrega duplicada de itens por webhook repetido.

## Produto

- Vender itens de progressão pode quebrar balanceamento do jogo.
- Falta de catálogo comercial explícito pode gerar inconsistência entre preço, item e entrega.

## Externos

- PixGo não oferecer exatamente os recursos necessários.
- Dependência de credenciais, sandbox e documentação fora do repositório.
- Requisitos regulatórios para conversão em cripto não estarem cobertos pelo provedor da forma esperada.

---

# Observações

- A existência de Stripe em [`packages/hub/src/controllers/api.ts`](packages/hub/src/controllers/api.ts) confirma um precedente arquitetural útil, mas não uma solução reutilizável pronta.
- O arquivo [`item_planning_file.md`](item_planning_file.md) é valioso para descoberta de domínio, porém não deve ser usado como catálogo comercial sem validação.
- Este plano evita assumir que Angular deve ser adotado; ele apenas mapeia as opções e recomenda a trilha de menor atrito arquitetural.
- Se o requisito “Angular” for mandatória decisão de negócio, a recomendação passa a ser um app isolado, não integração profunda com o frontend Astro atual.

---

# Próximos passos recomendados para posterior implementação

1. Confirmar oficialmente se Angular é requisito obrigatório ou apenas preferência.
2. Obter documentação oficial e credenciais sandbox da PixGo.
3. Aprovar o catálogo inicial de SKUs vendáveis, preferencialmente começando por cosméticos de [`packages/server/data/stores.json`](packages/server/data/stores.json).
4. Definir a política de entrega: `entitlement`, crédito premium ou item direto.
5. Escolher a arquitetura da storefront:
   - Astro no frontend atual, preferencialmente
   - Angular separado, se obrigatório
6. Planejar a camada backend de pagamentos no hub ou serviço adjacente, com adaptador de provedor.
7. Só então partir para implementação incremental do pedido, cobrança, webhook e entrega.
