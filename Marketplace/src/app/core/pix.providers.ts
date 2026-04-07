import {
  MarketplaceOrder,
  PaymentRecord,
  PixCharge,
  PixGoWebhookEvent,
  PixIntegrationMode,
  WebhookReceipt,
} from './models/marketplace.models';

export interface PixGoCheckoutRequest {
  readonly order: MarketplaceOrder;
  readonly successUrl: string;
  readonly webhookUrl: string;
}

export interface PixGoProviderPort {
  readonly providerName: 'PixGo';
  readonly mode: PixIntegrationMode;
  createCharge(request: PixGoCheckoutRequest): PixCharge;
  simulateWebhookConfirmation(order: MarketplaceOrder, charge: PixCharge): PixGoWebhookEvent;
  applyWebhook(
    event: PixGoWebhookEvent,
    payment: PaymentRecord,
  ): {
    payment: PaymentRecord;
    receipt: WebhookReceipt;
  };
}

export interface MarketplacePersistenceConfig {
  readonly database: 'acacia_marketplace';
  readonly collections: {
    readonly orders: 'marketplace_orders';
    readonly payments: 'marketplace_payments';
    readonly webhooks: 'marketplace_webhooks';
    readonly deliveries: 'marketplace_deliveries';
  };
}

export const marketplacePersistenceConfig: MarketplacePersistenceConfig = {
  database: 'acacia_marketplace',
  collections: {
    orders: 'marketplace_orders',
    payments: 'marketplace_payments',
    webhooks: 'marketplace_webhooks',
    deliveries: 'marketplace_deliveries',
  },
};

export const pixProviderNotes = {
  implemented: [
    'catálogo, checkout e pagamento funcionam no frontend do MVP',
    'checkout PixGo é gerado por adapter mock local com contrato estável',
    'confirmação de pagamento pode ser simulada de forma controlada no app',
    'status final da entrega aparece automaticamente após a confirmação mock',
  ],
  productionGaps: [
    'substituir o adapter mock por integração HTTP autenticada com a API PixGo',
    'publicar endpoint backend real para receber webhooks assinados',
    'persistir pedidos, pagamentos, webhooks e entregas em MongoDB real',
    'integrar a entrega ao runtime do jogo com fila, retry e observabilidade',
  ],
} as const;

export class MockPixGoProvider implements PixGoProviderPort {
  readonly providerName = 'PixGo';
  readonly mode: PixIntegrationMode = 'pixgo-webhook-contract';

  createCharge(request: PixGoCheckoutRequest): PixCharge {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const token = request.order.id.toLowerCase();

    return {
      provider: 'PixGo',
      checkoutId: `PG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionReference: `pixgo-${token}`,
      qrCodePayload: `00020126580014BR.GOV.BCB.PIX0136pixgo-${token}520400005303986540${request.order.item.totalPriceInBrl.toFixed(2)}5802BR5913ACACIA STORE6009SAO PAULO62070503***6304ABCD`,
      qrCodeEmv: `PIXGO|ORDER:${request.order.id}|AMOUNT:${request.order.item.totalPriceInBrl.toFixed(2)}`,
      amountInBrl: request.order.item.totalPriceInBrl,
      expiresAt,
      status: 'pending',
      mode: this.mode,
      checkoutUrl: `${request.successUrl}?checkout=${token}`,
      instructions: [
        'Copie o código PIX ou use o QR Code para pagar.',
        'Após a confirmação, o item segue automaticamente para entrega.',
        'No MVP, a confirmação é simulada dentro do próprio app.',
      ],
    };
  }

  simulateWebhookConfirmation(order: MarketplaceOrder, charge: PixCharge): PixGoWebhookEvent {
    const occurredAt = new Date().toISOString();

    return {
      eventId: `WE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      eventType: 'payment.confirmed',
      provider: 'PixGo',
      occurredAt,
      checkoutId: charge.checkoutId,
      transactionReference: charge.transactionReference,
      orderId: order.id,
      amountInBrl: charge.amountInBrl,
      payloadMode: 'mock',
      payload: {
        provider: 'PixGo',
        checkoutId: charge.checkoutId,
        transactionReference: charge.transactionReference,
        paidAt: occurredAt,
        orderId: order.id,
        amountInBrl: charge.amountInBrl,
      },
    };
  }

  applyWebhook(
    event: PixGoWebhookEvent,
    payment: PaymentRecord,
  ): {
    payment: PaymentRecord;
    receipt: WebhookReceipt;
  } {
    const confirmedPayment: PaymentRecord = {
      ...payment,
      status: 'confirmed',
      confirmedAt: event.occurredAt,
      rawWebhookEvent: event,
    };

    return {
      payment: confirmedPayment,
      receipt: {
        provider: 'PixGo',
        status: 'accepted',
        receivedAt: new Date().toISOString(),
        event,
      },
    };
  }
}
