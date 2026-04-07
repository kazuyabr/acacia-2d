# Integração PixGo no MVP

## Premissa

PixGo é tratado como provedor de checkout e confirmação de pagamento via webhook, mas este MVP não inventa detalhes proprietários não confirmados. Por isso, a integração está organizada como contrato + adapter mockado.

## Fluxo modelado

1. o app cria um pedido com status `draft`
2. o workflow gera uma cobrança PixGo e move o pedido para `pending_payment`
3. o checkout expõe `checkoutId`, `transactionReference`, payload Pix e `checkoutUrl`
4. um webhook `payment.confirmed` é recebido
5. o pagamento vira `confirmed`
6. o pedido vai para `paid`
7. a entrega automática é disparada

## Contrato de cobrança

```json
{
  "provider": "PixGo",
  "checkoutId": "PG-1A2B3C4D",
  "transactionReference": "pixgo-mp-1a2b3c4d",
  "amountInBrl": 39.9,
  "status": "pending",
  "mode": "pixgo-webhook-contract",
  "checkoutUrl": "https://acacia.local/marketplace/payment?checkout=mp-1a2b3c4d",
  "expiresAt": "2026-04-06T15:15:00.000Z"
}
```

## Contrato de webhook

```json
{
  "eventId": "WE-8F7E6D5C",
  "eventType": "payment.confirmed",
  "provider": "PixGo",
  "occurredAt": "2026-04-06T15:05:00.000Z",
  "checkoutId": "PG-1A2B3C4D",
  "transactionReference": "pixgo-mp-1a2b3c4d",
  "orderId": "MP-1A2B3C4D",
  "amountInBrl": 39.9,
  "payloadMode": "mock",
  "payload": {
    "provider": "PixGo",
    "checkoutId": "PG-1A2B3C4D",
    "transactionReference": "pixgo-mp-1a2b3c4d",
    "paidAt": "2026-04-06T15:05:00.000Z"
  }
}
```

## Responsabilidades do adapter atual

- criar cobrança local com dados suficientes para o frontend
- representar o contrato esperado para checkout PixGo
- gerar um evento de webhook controlado para testes do fluxo
- aplicar o webhook sobre o registro de pagamento

## Pontos de troca para produção

### Adapter PixGo real

Substituir o `MockPixGoProvider` por implementação que:

- chame a API real da PixGo
- assine/autentique as requisições
- trate expiração, falha e retries
- normalize resposta da API para o contrato interno

### Webhook real

Criar endpoint backend que:

- receba chamadas da PixGo
- valide assinatura/origem
- persista o evento bruto
- aplique idempotência por `eventId`
- atualize `payments` e publique evento para entrega

## O que está implementado hoje

- frontend funcional consumindo o contrato
- geração de cobrança mockada
- confirmação mockada via botão que simula o webhook
- atualização de status do pagamento e do pedido após a confirmação
