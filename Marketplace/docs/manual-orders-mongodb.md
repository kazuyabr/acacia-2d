# Pedidos manuais no MongoDB

## Objetivo

Registrar pedidos confirmados no checkout para controle operacional de entrega manual.

## Banco e coleção sugeridos

- database: `acacia_marketplace`
- collection: `manual_marketplace_orders`

## Documento mínimo

```json
{
  "orderId": "MP-AB12CD34",
  "accountId": "player-001",
  "characterName": "AcaciaHero",
  "realm": "main-world",
  "email": "hero@example.com",
  "sku": "ratpet",
  "itemName": "Rat Pet",
  "totalInBrl": 24.9,
  "paymentStatus": "confirmed",
  "paymentConfirmedAt": "2026-04-06T15:00:00.000Z",
  "checkoutReference": "pixgo-checkout-mp-ab12cd34",
  "deliveryMode": "manual",
  "deliveryStatus": "pending",
  "operatorNotes": "Separar entrega manual no jogo.",
  "createdAt": "2026-04-06T15:00:00.000Z"
}
```

## Campos operacionais

- `paymentStatus`: deve ficar em `confirmed`
- `deliveryMode`: deve ficar em `manual`
- `deliveryStatus`: começa em `pending`
- `operatorNotes`: observação livre para a equipe

## Exemplo de insert

```javascript
db.manual_marketplace_orders.insertOne({
  orderId: 'MP-AB12CD34',
  accountId: 'player-001',
  characterName: 'AcaciaHero',
  realm: 'main-world',
  email: 'hero@example.com',
  sku: 'ratpet',
  itemName: 'Rat Pet',
  totalInBrl: 24.9,
  paymentStatus: 'confirmed',
  paymentConfirmedAt: '2026-04-06T15:00:00.000Z',
  checkoutReference: 'pixgo-checkout-mp-ab12cd34',
  deliveryMode: 'manual',
  deliveryStatus: 'pending',
  operatorNotes: 'Separar entrega manual no jogo.',
  createdAt: '2026-04-06T15:00:00.000Z'
});
```

## Limites deste MVP

- contrato documental apenas
- sem conexão MongoDB implementada
- sem painel operacional
- sem automação de entrega
