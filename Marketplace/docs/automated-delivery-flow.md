# Fluxo de entrega automatizada

## Visão geral

A entrega automatizada existe neste MVP como fluxo funcional de negócio dentro do app, ainda que executada por adapter mockado.

## Etapas

1. pedido é criado em `draft`
2. checkout PixGo é criado e o pedido vira `pending_payment`
3. webhook `payment.confirmed` é recebido
4. pagamento vira `confirmed`
5. pedido vai para `paid`
6. é gerado um `DeliveryCommand`
7. o adapter de entrega processa o comando
8. o pedido termina em `delivered` ou `failed`

## Comando de entrega

```json
{
  "commandId": "DL-5D4C3B2A",
  "orderId": "MP-1A2B3C4D",
  "accountId": "player-001",
  "characterName": "AcaciaHero",
  "realm": "main-world",
  "sku": "ember-fox-pet",
  "quantity": 1,
  "requestedAt": "2026-04-06T15:05:00.000Z",
  "strategy": "inventory-grant"
}
```

## O que o adapter mock atual faz

- recebe o comando
- registra uma tentativa de entrega
- retorna sucesso imediato
- produz um `DeliveryRecord` exibido no frontend

## O que falta para produção

### Backend do jogo

- endpoint ou fila para aceitar `DeliveryCommand`
- validação do personagem, realm e permissões
- aplicação real do item no inventário/cosmético/pet
- retorno persistido do resultado de entrega

### Operação

- retries com backoff
- idempotência por `orderId` e `commandId`
- telemetria e logs
- dashboard operacional para falhas

## Motivo do desenho atual

O app precisava deixar a automação explícita e verificável no MVP sem afirmar integração real inexistente. Por isso a automação está representada em código executável, mas encapsulada como adapter que pode ser trocado depois.
