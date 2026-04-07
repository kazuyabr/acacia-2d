# Objetivo

Replanejar o MVP de [`Marketplace/`](Marketplace/) para transformar o fluxo atual em uma compra de item do jogo realmente utilizável, curta e executável em uma próxima etapa de implementação limitada a [`Marketplace/`](Marketplace/).

# Contexto

O estado atual do MVP em [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts:1), [`Marketplace/src/app/app.html`](Marketplace/src/app/app.html:1), [`Marketplace/src/app/core/models/marketplace.models.ts`](Marketplace/src/app/core/models/marketplace.models.ts:1), [`Marketplace/src/app/core/pix.providers.ts`](Marketplace/src/app/core/pix.providers.ts:1), [`Marketplace/src/app/core/services/marketplace-workflow.service.ts`](Marketplace/src/app/core/services/marketplace-workflow.service.ts:1), [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts:1) e [`Marketplace/README.md`](Marketplace/README.md) prioriza a demonstração do pipeline técnico de pedido → webhook → entrega. Isso deixa explícitos contratos e mocks, mas produz uma UX pouco comprável na prática.

O usuário reportou que o fluxo atual é irreal, impraticável e não torna a compra efetivamente concluível mesmo após selecionar um item. O novo plano deve corrigir isso sem implementar nada agora.

# Decisões aplicadas

- Respeitar o contexto global descrito em [`.vibecoding/architecture/architecture.md`](.vibecoding/architecture/architecture.md) e [`.vibecoding/decisions/decisions.md`](.vibecoding/decisions/decisions.md).
- Limitar a próxima execução em modo Code a [`Marketplace/`](Marketplace/).
- Priorizar fluxo de compra enxuto e direto sobre exposição de estados internos.
- Separar claramente o que é frontend real, o que é mock local e o que depende de backend real.
- Tratar PixGo como integração de checkout/pagamento e a entrega do item como consequência de backend, não como responsabilidade primária da tela.

# Diagnóstico do MVP atual

## Por que o fluxo atual não é comprável na prática

1. **O fluxo foi desenhado como demo técnica, não como checkout real.**
   - A tela principal enfatiza pipeline, webhook, timeline, preview de MongoDB e estados internos em vez de guiar a compra.
   - Isso aparece de forma explícita em [`Marketplace/src/app/app.html`](Marketplace/src/app/app.html:1).

2. **Há etapas demais para uma compra simples.**
   - O stepper de [`MarketplaceStep`](Marketplace/src/app/core/models/marketplace.models.ts:1) força quatro macroestados: catálogo, checkout, pagamento e entrega.
   - Para compra de item digital, o usuário deveria sair do item para o pagamento em no máximo um formulário curto + uma tela de pagamento.

3. **O formulário pede dados demais cedo demais.**
   - [`BuyerForm`](Marketplace/src/app/core/models/marketplace.models.ts:28) exige `accountId`, personagem, realm, e-mail, nome do pagador Pix e observações.
   - Para MVP comprável, `notes` não deve ser campo principal e `pixPayerName` pode ser opcional ou contextual.
   - `accountId` é um identificador técnico pouco amigável para compra manual.

4. **A seleção do item não vira checkout prático.**
   - [`selectProduct()`](Marketplace/src/app/app.ts:72) apenas muda a etapa para checkout.
   - Não existe resumo de pedido orientado à confirmação rápida, nem CTA do tipo “Comprar agora”.

5. **Não existe modelagem prática de quantidade.**
   - [`createOrderItem()`](Marketplace/src/app/core/services/marketplace-workflow.service.ts:170) fixa `quantity: 1`.
   - O fluxo não deixa claro quando quantidade é permitida, quando é travada e como isso afeta total e entrega.

6. **Realm e item não são tratados com regras de compatibilidade úteis para UX.**
   - O catálogo usa `realmScope` em [`Marketplace/src/app/features/catalog/catalog.data.ts`](Marketplace/src/app/features/catalog/catalog.data.ts:3), mas o checkout ainda permite qualquer seleção genérica de realm.
   - Isso pode gerar combinação inválida entre item e realm sem prevenção real.

7. **O pagamento não é apresentado como ação de conclusão, mas como simulação técnica.**
   - A tela expõe `checkoutId`, `transactionReference`, `qrCodeEmv`, botão de simular webhook e payloads internos.
   - O usuário real precisa ver: valor, QR Code/copia e cola, expiração, instrução simples e status de confirmação.

8. **A confirmação de pagamento está misturada com mecanismo interno.**
   - [`simulatePaymentConfirmation()`](Marketplace/src/app/app.ts:98) é correto como mock, mas está exposto como ação principal da compra.
   - Isso é útil para demonstração técnica, mas ruim para UX do comprador.

9. **A entrega automatizada é mostrada como timeline interna detalhada, não como estado claro do pedido.**
   - O usuário precisa saber apenas se o item está: aguardando pagamento, pagamento confirmado, entrega em processamento ou entregue.
   - Timeline completa, comando interno e preview de persistência devem sair da UX principal.

10. **O código atual mistura responsabilidades de tela de compra com visibilidade operacional.**
    - [`MarketplaceWorkflowService`](Marketplace/src/app/core/services/marketplace-workflow.service.ts:22) acumula criação de pedido, criação de cobrança, confirmação, entrega e preview de persistência.
    - O app root também concentra toda a orquestração visual.

## Resumo objetivo do problema

O MVP atual é legível para desenvolvedor, mas não para comprador. A compra não parece uma compra real; parece um simulador interno de estados do sistema.

# Estratégia

Redesenhar o MVP como um fluxo de **compra curta em 3 momentos**:

1. **Escolher item**
2. **Informar dados mínimos e revisar pedido**
3. **Gerar e acompanhar pagamento PIX até confirmação e status de entrega**

A UX deve remover tudo que não ajuda o comprador a concluir a compra. Estados internos continuam existindo no código, mas deixam de ser protagonistas da interface.

# Novo fluxo UX recomendado

## Fluxo ideal do usuário do começo ao fim

1. Usuário acessa a loja e vê apenas catálogo objetivo.
2. Seleciona um item e aciona **Comprar agora**.
3. Abre um checkout curto com:
   - item
   - quantidade, se o item permitir
   - personagem
   - realm compatível
   - e-mail
4. O checkout mostra resumo do pedido em tempo real.
5. Usuário confirma e gera o pagamento PIX/PixGo.
6. A tela de pagamento mostra:
   - nome do item
   - total
   - QR Code / copia e cola
   - tempo de expiração
   - status “Aguardando pagamento”
7. Após confirmação, a tela muda para:
   - pagamento confirmado
   - entrega em processamento
   - entregue ao personagem informado, ou pendente de backend real
8. Usuário pode copiar número do pedido e ver estado final simples.

## Fluxo mínimo em termos de telas/estados

### Manter

- **Catálogo**
- **Checkout**
- **Pagamento/Status do pedido**

### Remover da UX principal

- stepper de quatro etapas
- tela dedicada de timeline
- status cards técnicos permanentes
- preview de MongoDB
- payload bruto de webhook
- comando interno de entrega
- bloco de integração técnica como conteúdo principal
- botão com linguagem técnica como “Simular webhook payment.confirmed” na ação principal

### Reposicionar

- detalhes técnicos e mocks devem ir para seção secundária discreta de “Ambiente de demonstração”, não para o caminho principal da compra.

# Regras de negócio mínimas para compra de item do jogo

## Campos mínimos obrigatórios

- `characterName`
- `realm`
- `email`

## Campos condicionais

- `quantity`: somente para itens marcados como multiplicáveis
- `pixPayerName`: opcional no frontend MVP; se necessário para o provedor real, preencher no backend ou solicitar apenas depois
- `accountId`: não deve ser campo principal de entrada manual no MVP, salvo se houver regra real que o torne indispensável
- `notes`: opcional, colapsado ou removido do fluxo principal

## Regras de compatibilidade

- Se o item for de realm único, o realm já deve vir travado ou pré-selecionado.
- Se o item for `all-realms`, o usuário escolhe o realm.
- Se o item não permitir múltiplas unidades, quantidade fica fixa em `1`.
- O resumo deve recalcular total ao mudar quantidade.

## Estados de pedido mínimos visíveis ao usuário

- `checkout_ready`
- `awaiting_payment`
- `payment_confirmed`
- `delivery_processing`
- `delivered`
- `delivery_pending_manual_action` somente quando depender de backend real não integrado

## Separação frontend x backend

### No frontend

- seleção do item
- captura de dados mínimos
- resumo do pedido
- exibição do PIX/PixGo
- polling/simulação visual de status
- mensagem final de entrega/status

### No mock local

- geração de checkout PixGo fake
- confirmação manual controlada para demonstração
- evolução do estado até entregue ou pendente

### No backend real futuro

- criação persistida do pedido
- chamada autenticada à PixGo
- webhook real e idempotente
- entrega real do item ao jogo
- retries, logs e auditoria

# Estratégia específica de UX

## 1. Catálogo

A listagem de produtos deve ser mais curta em texto e mais orientada a conversão:

- nome
- descrição curta
- preço
- realm suportado
- entrega automática
- CTA principal: **Comprar agora**

Não mostrar timeline do processo nessa etapa.

## 2. Checkout curto

O checkout deve combinar formulário e resumo na mesma área.

### Ordem recomendada

1. item selecionado
2. quantidade (se aplicável)
3. personagem
4. realm
5. e-mail
6. resumo com total
7. botão **Gerar PIX**

### Fricção a remover

- `accountId` no formulário principal
- `pixPayerName` como campo obrigatório
- `notes` aberto por padrão
- linguagem técnica como `draft`, `pending_payment` e `webhook`

## 3. Pagamento PIX/PixGo

A tela de pagamento deve ser utilitária.

### Exibir com destaque

- valor total
- item + quantidade
- personagem + realm
- QR Code
- código copia e cola
- expiração
- estado atual da compra

### CTA/status principal

- **Aguardando pagamento**
- em ambiente mock, botão secundário de demonstração: **Simular pagamento confirmado**

### Linguagem recomendada

- “Pague com PIX para liberar seu item.”
- “Assim que o pagamento for confirmado, iniciaremos a entrega.”
- “Pagamento confirmado. Entrega em processamento.”

## 4. Confirmação e entrega

A última visão deve ser uma tela de status final simples.

### Mostrar

- pedido confirmado
- item
- personagem
- realm
- situação da entrega
- identificador do pedido

### Não mostrar por padrão

- payload de webhook
n- documento MongoDB
- comando de entrega
- timeline técnica detalhada

# Estratégia de integração PixGo e automação de entrega

## PixGo

O código deve ser reorganizado para tratar PixGo em dois níveis:

1. **Contrato interno estável** para o frontend
2. **Adapter de provider** mock ou real

### Para o próximo Code mode

- manter adapter mock em [`Marketplace/src/app/core/pix.providers.ts`](Marketplace/src/app/core/pix.providers.ts:1)
- simplificar o objeto visível para a UI
- priorizar os campos:
  - identificador do checkout
  - payload copia e cola
  - URL/QR Code
  - valor
  - expiração
  - status

### O que deve ficar explícito no plano e no código

- **Real hoje:** UI de checkout e exibição de PIX
- **Mock hoje:** confirmação local de pagamento
- **Backend real futuro:** webhook assinado, persistência e reconciliação

## Entrega automatizada

A entrega deve ser representada no frontend como **resultado de status**, não como execução detalhada.

### Regra de modelagem

- frontend não “entrega item”; frontend apenas exibe o status da entrega
- service interno pode continuar simulando a transição para fins de MVP
- o modelo precisa distinguir:
  - entrega simulada concluída
  - entrega aguardando backend real
  - falha de entrega

### Recomendação prática

Adicionar um modo de entrega mais explícito:

- `mock_auto_delivered`
- `backend_pending`
- `failed`

Isso evita fingir integração real inexistente.

# Estrutura recomendada de componentes, serviços e modelos

## Componentes sugeridos dentro de [`Marketplace/src/app/`](Marketplace/src/app/)

- [`Marketplace/src/app/app.ts`](Marketplace/src/app/app.ts:1) deve deixar de concentrar toda a lógica.
- Estrutura alvo recomendada:
  - `features/catalog/` para catálogo e seleção
  - `features/checkout/` para formulário curto + resumo
  - `features/payment/` para PIX/status do pedido
  - `features/order-status/` para confirmação e entrega

## Serviços sugeridos

- `MarketplaceWorkflowService`: orquestra estados de alto nível do pedido
- `CheckoutFormMapper` ou utilitário similar: normaliza formulário para pedido
- `PixCheckoutService` ou adapter atual extraído: cria e atualiza cobrança
- `OrderStatusPresenter` ou utilitário leve: converte estados internos para textos amigáveis da UI

## Modelos recomendados

### Ajustar ou criar modelos focados na UX

- `CatalogProduct`
  - adicionar flags como `supportsQuantity`, `minQuantity`, `maxQuantity`
  - substituir `realmScope` textual por modelagem mais utilizável para validação

- `CheckoutForm`
  - `characterName`
  - `realm`
  - `email`
  - `quantity`
  - opcionais colapsados se necessário

- `CheckoutSummary`
  - item
  - subtotal
  - total
  - deliveryTarget

- `OrderStatusViewModel`
  - `headline`
  - `description`
  - `badge`
  - `canRetryPayment`
  - `canSimulateInMock`

### Reduzir protagonismo de modelos técnicos na UI

- [`PixGoWebhookEvent`](Marketplace/src/app/core/models/marketplace.models.ts:99)
- [`WebhookReceipt`](Marketplace/src/app/core/models/marketplace.models.ts:112)
- [`PersistencePreview`](Marketplace/src/app/core/models/marketplace.models.ts:148)
- [`TimelineEntry`](Marketplace/src/app/core/models/marketplace.models.ts:164)

Esses modelos podem continuar existindo para suporte interno/mock, mas não devem dirigir a UX principal.

# Etapas para a próxima implementação em Code mode

1. **Redesenhar a navegação da UI**
   - remover stepper de quatro etapas
   - consolidar fluxo em catálogo → checkout → pagamento/status

2. **Simplificar o formulário de compra**
   - trocar [`BuyerForm`](Marketplace/src/app/core/models/marketplace.models.ts:28) por um modelo de checkout mínimo
   - remover obrigatoriedade de `accountId`, `pixPayerName` e `notes` do fluxo principal

3. **Modelar quantidade e compatibilidade de realm**
   - enriquecer [`CatalogProduct`](Marketplace/src/app/core/models/marketplace.models.ts:15)
   - impedir combinações inválidas já no frontend

4. **Criar resumo prático do pedido**
   - item
   - quantidade
   - personagem
   - realm
   - e-mail
   - total

5. **Refatorar a tela de pagamento**
   - focar em QR Code, copia e cola, valor, expiração e status
   - mover elementos técnicos para área secundária de demonstração

6. **Reorganizar os estados visíveis do fluxo**
   - substituir terminologia técnica na UI por textos amigáveis
   - manter estados técnicos apenas em services/models

7. **Refatorar [`MarketplaceWorkflowService`](Marketplace/src/app/core/services/marketplace-workflow.service.ts:22)**
   - separar criação de pedido, criação de cobrança, confirmação de pagamento e atualização de status de entrega
   - introduzir mapeamento para view models da UI

8. **Ajustar o catálogo**
   - rever descrições e metadados para suportar compra rápida
   - deixar claro quando item é automático, qual realm aceita e se aceita quantidade

9. **Atualizar [`Marketplace/README.md`](Marketplace/README.md)**
   - refletir o novo fluxo simples
   - explicitar limites do mock sem tornar isso o centro da experiência

# Critérios objetivos de aceite

A próxima implementação em Code mode deve atender aos seguintes critérios:

1. Usuário consegue selecionar um item e iniciar compra com um único CTA claro.
2. Usuário preenche apenas dados mínimos relevantes para entrega do item.
3. Se o item permitir quantidade, o total é recalculado corretamente.
4. Realm incompatível não pode ser selecionado para item restrito.
5. O checkout gera pagamento PIX/PixGo de forma clara e direta.
6. A tela de pagamento mostra valor, item, personagem, realm, expiração e código PIX sem excesso de detalhes técnicos.
7. Em ambiente mock, existe um caminho explícito e secundário para simular confirmação de pagamento.
8. Após confirmação, o usuário vê estado de entrega simples e compreensível.
9. A UI deixa explícito o que é real, o que é mock e o que depende de backend real.
10. O código permanece organizado dentro de [`Marketplace/`](Marketplace/) com separação melhor entre catálogo, checkout, pagamento e status do pedido.

# Riscos

- Simplificar demais e esconder informações úteis para operação técnica; mitigação: mover detalhes para área secundária, não removê-los completamente do código.
- Manter nomes de status internos acoplados à UI; mitigação: criar camada de apresentação.
- Persistir a falsa impressão de integração real com PixGo e entrega; mitigação: rotular claramente mock e backend futuro.
- Introduzir regra de quantidade sem considerar restrições por item; mitigação: modelar isso no catálogo.

# Observações

- O foco do próximo ciclo não é “mais arquitetura de demonstração”, e sim comprabilidade.
- O app deve parecer uma loja funcional de item digital, não um painel de inspeção de fluxo interno.
- O mock continua válido para MVP, desde que fique claro que:
  - o PIX exibido é representado no frontend
  - a confirmação real depende de backend/webhook
  - a entrega real depende de integração com o jogo
- A implementação futura deve permanecer estritamente dentro de [`Marketplace/`](Marketplace/).
