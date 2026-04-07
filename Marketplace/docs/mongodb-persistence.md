# Persistência MongoDB para o marketplace

## Objetivo

Definir uma estrutura compatível com o MVP para persistir pedidos, pagamentos, webhooks e entregas sem depender de detalhes fora de `Marketplace/`.

## Banco sugerido

- database: `acacia_marketplace`

## Coleções

- `marketplace_orders`
- `marketplace_payments`
- `marketplace_webhooks`
- `marketplace_deliveries`

## Documento de pedido

```json
{
  "orderId": "MP-1A2B3C4D",
  "status": "delivered",
  "createdAt": "2026-04-06T15:00:00.000Z",
  "updatedAt": "2026-04-06T15:05:02.000Z",
  "accountId": "player-001",
  "characterName": "AcaciaHero",
  "realm": "main-world",
  "email": "hero@example.com",
  "item": {
    "sku": "ember-fox-pet",
    "name": "Ember Fox Pet",
    "quantity": 1,
    "unitPriceInBrl": 39.9,
    "totalPriceInBrl": 39.9
  },
  "source": "marketplace-web",
  "timeline": []
}
```

## Documento de pagamento

```json
{
  "orderId": "MP-1A2B3C4D",
  "provider": "PixGo",
  "checkoutId": "PG-1A2B3C4D",
  "transactionReference": "pixgo-mp-1a2b3c4d",
  "amountInBrl": 39.9,
  "status": "confirmed",
  "mode": "pixgo-webhook-contract",
  "createdAt": "2026-04-06T15:00:10.000Z",
  "confirmedAt": "2026-04-06T15:05:00.000Z"
}
```

## Documento de webhook

```json
{
  "provider": "PixGo",
  "status": "accepted",
  "receivedAt": "2026-04-06T15:05:00.100Z",
  "event": {
    "eventId": "WE-8F7E6D5C",
    "eventType": "payment.confirmed",
    "orderId": "MP-1A2B3C4D",
    "checkoutId": "PG-1A2B3C4D"
  }
}
```

## Documento de entrega

```json
{
  "orderId": "MP-1A2B3C4D",
  "status": "delivered",
  "processor": "mock-game-delivery-adapter",
  "command": {
    "commandId": "DL-5D4C3B2A",
    "strategy": "inventory-grant",
    "accountId": "player-001",
    "characterName": "AcaciaHero",
    "realm": "main-world",
    "sku": "ember-fox-pet",
    "quantity": 1
  },
  "attempts": [
    {
      "attemptId": "AT-9Z8Y7X6W",
      "status": "success",
      "processedAt": "2026-04-06T15:05:02.000Z",
      "message": "Item concedido automaticamente ao personagem."
    }
  ],
  "resultMessage": "Item concedido automaticamente ao personagem."
}
```

## Índices recomendados

- `marketplace_orders.orderId` único
- `marketplace_payments.checkoutId` único
- `marketplace_payments.transactionReference` único
- `marketplace_webhooks.event.eventId` único
- `marketplace_deliveries.orderId` único

## Observações

- o app atual apenas exibe preview desses documentos
- a persistência real deve ser feita em backend seguro
- a separação por coleções facilita auditoria operacional e reprocessamento de entrega
