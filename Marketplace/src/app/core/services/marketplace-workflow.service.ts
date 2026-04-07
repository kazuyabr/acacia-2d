import {
  marketplacePersistenceConfig,
  MockPixGoProvider,
  type PixGoProviderPort,
} from '../pix.providers';
import type {
  CatalogProduct,
  CheckoutForm,
  CheckoutSummary,
  DeliveryAttempt,
  DeliveryCommand,
  DeliveryRecord,
  MarketplaceOrder,
  OrderItem,
  OrderStatus,
  OrderStatusViewModel,
  PaymentRecord,
  PersistencePreview,
  TimelineEntry,
  WorkflowState,
} from '../models/marketplace.models';

export class MarketplaceWorkflowService {
  private readonly pixProvider: PixGoProviderPort;

  constructor(pixProvider: PixGoProviderPort = new MockPixGoProvider()) {
    this.pixProvider = pixProvider;
  }

  createEmptyCheckoutForm(): CheckoutForm {
    return {
      characterName: '',
      realm: '',
      email: '',
      quantity: 1,
    };
  }

  createCheckoutForm(product: CatalogProduct, previous: Partial<CheckoutForm> = {}): CheckoutForm {
    const availableRealms = this.getAvailableRealms(product);
    const preferredRealm = previous.realm?.trim() ?? '';

    return {
      characterName: previous.characterName ?? '',
      realm: this.isRealmSupported(product, preferredRealm) ? preferredRealm : (availableRealms[0] ?? ''),
      email: previous.email ?? '',
      quantity: this.normalizeQuantity(product, Number(previous.quantity ?? product.minQuantity)),
    };
  }

  getAvailableRealms(product: CatalogProduct): readonly string[] {
    return product.supportedRealms;
  }

  normalizeQuantity(product: CatalogProduct, quantity: number): number {
    if (!product.supportsQuantity) {
      return 1;
    }

    return Math.min(
      product.maxQuantity,
      Math.max(product.minQuantity, Math.floor(quantity || product.minQuantity)),
    );
  }

  isRealmSupported(product: CatalogProduct, realm: string): boolean {
    return product.supportedRealms.includes(realm);
  }

  isCheckoutValid(product: CatalogProduct, form: CheckoutForm): boolean {
    return this.getCheckoutValidationMessage(product, form) === null;
  }

  getCheckoutValidationMessage(product: CatalogProduct, form: CheckoutForm): string | null {
    const characterName = form.characterName.trim();
    const realm = form.realm.trim();
    const email = form.email.trim();

    if (!characterName) {
      return 'Informe o nome do personagem para receber o item.';
    }

    if (!realm || !this.isRealmSupported(product, realm)) {
      return 'Escolha um realm compatível com este item.';
    }

    if (!email) {
      return 'Informe o e-mail para receber a confirmação do pedido.';
    }

    if (!this.isValidEmail(email)) {
      return 'Informe um e-mail válido antes de gerar o PIX.';
    }

    return null;
  }

  createSummary(product: CatalogProduct, form: CheckoutForm): CheckoutSummary {
    const quantity = this.normalizeQuantity(product, form.quantity);
    const subtotalInBrl = product.priceInBrl * quantity;
    const characterName = form.characterName.trim();
    const realm = this.isRealmSupported(product, form.realm.trim())
      ? form.realm.trim()
      : (this.getAvailableRealms(product)[0] ?? '');
    const email = form.email.trim();

    return {
      itemName: product.name,
      quantity,
      unitPriceInBrl: product.priceInBrl,
      subtotalInBrl,
      totalInBrl: subtotalInBrl,
      characterName,
      realm,
      email,
      deliveryTarget: `${characterName || 'Personagem'} • ${realm || 'realm não definido'}`,
    };
  }

  createDraftOrder(product: CatalogProduct, form: CheckoutForm): MarketplaceOrder {
    const createdAt = new Date().toISOString();
    const summary = this.createSummary(product, form);
    const item = this.createOrderItem(product, summary.quantity);
    const timeline = [
      this.timelineEntry(
        'order.created',
        'Pedido iniciado',
        'Checkout validado com item, personagem, realm e valor revisados.',
        createdAt,
        'done',
      ),
    ];

    return {
      id: `MP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt,
      updatedAt: createdAt,
      status: 'checkout_ready',
      buyer: {
        characterName: summary.characterName,
        realm: summary.realm,
        email: summary.email,
      },
      item,
      source: 'marketplace-web',
      timeline,
      metadata: {
        realm: summary.realm,
        automationMode: product.deliveryMode,
        notes:
          product.deliveryMode === 'backend_pending'
            ? 'Pagamento confirmado, mas a entrega final depende de backend real.'
            : 'Entrega automática mockada para o MVP logo após a confirmação do pagamento.',
      },
    };
  }

  startPayment(order: MarketplaceOrder): WorkflowState {
    const charge = this.pixProvider.createCharge({
      order,
      successUrl: 'https://acacia.local/marketplace/payment',
      webhookUrl: 'https://acacia.local/api/webhooks/pixgo',
    });

    const pendingAt = new Date().toISOString();
    const awaitingPaymentOrder = this.updateOrderStatus(
      order,
      'awaiting_payment',
      this.timelineEntry(
        'payment.checkout_created',
        'PIX gerado',
        'Cobrança PIX pronta. O pedido agora aguarda a confirmação do pagamento.',
        pendingAt,
        'active',
      ),
    );

    const payment: PaymentRecord = {
      orderId: awaitingPaymentOrder.id,
      provider: 'PixGo',
      checkoutId: charge.checkoutId,
      transactionReference: charge.transactionReference,
      amountInBrl: charge.amountInBrl,
      status: 'pending',
      mode: charge.mode,
      createdAt: pendingAt,
      confirmedAt: null,
      rawWebhookEvent: null,
    };

    return {
      order: awaitingPaymentOrder,
      charge,
      payment,
      webhook: null,
      delivery: null,
      persistence: this.buildPersistencePreview(awaitingPaymentOrder, payment, null, null),
    };
  }

  confirmPayment(state: WorkflowState): WorkflowState {
    if (!state.order || !state.charge || !state.payment) {
      return state;
    }

    const webhookEvent = this.pixProvider.simulateWebhookConfirmation(state.order, state.charge);
    const webhookResult = this.pixProvider.applyWebhook(webhookEvent, state.payment);

    const paymentConfirmedOrder = this.updateOrderStatus(
      state.order,
      'payment_confirmed',
      this.timelineEntry(
        'webhook.received',
        'Confirmação recebida',
        'O MVP recebeu a confirmação mock do pagamento PIX.',
        webhookResult.receipt.receivedAt,
        'done',
      ),
      this.timelineEntry(
        'payment.confirmed',
        'Pagamento confirmado',
        'Pagamento conciliado. A entrega do item foi liberada.',
        webhookEvent.occurredAt,
        'done',
      ),
    );

    const processingOrder = this.updateOrderStatus(
      paymentConfirmedOrder,
      'delivery_processing',
      this.timelineEntry(
        'delivery.started',
        'Entrega em processamento',
        'O item entrou na fila de entrega logo após a confirmação do PIX.',
        webhookEvent.occurredAt,
        'active',
      ),
    );

    const delivery = this.runDelivery(processingOrder, webhookEvent.occurredAt);
    const finalStatus: OrderStatus =
      delivery.status === 'delivered'
        ? 'delivered'
        : delivery.status === 'pending_manual_action'
          ? 'delivery_pending_manual_action'
          : 'failed';

    const finalOrder = this.updateOrderStatus(
      processingOrder,
      finalStatus,
      this.timelineEntry(
        delivery.status === 'delivered' ? 'delivery.completed' : 'delivery.failed',
        delivery.status === 'delivered' ? 'Entrega concluída' : 'Entrega pendente',
        delivery.resultMessage,
        delivery.lastUpdatedAt,
        delivery.status === 'delivered' ? 'done' : 'warning',
      ),
    );

    return {
      order: finalOrder,
      charge: {
        ...state.charge,
        status: 'confirmed',
      },
      payment: webhookResult.payment,
      webhook: webhookResult.receipt,
      delivery,
      persistence: this.buildPersistencePreview(finalOrder, webhookResult.payment, webhookResult.receipt, delivery),
    };
  }

  getStatusViewModel(state: WorkflowState): OrderStatusViewModel {
    if (!state.order) {
      return {
        headline: 'Escolha um item para começar',
        description: 'Clique em Comprar agora em um produto para abrir o checkout prático.',
        badge: 'Sem pedido',
        tone: 'info',
        canRetryPayment: false,
        canSimulateInMock: false,
      };
    }

    switch (state.order.status) {
      case 'awaiting_payment':
        return {
          headline: 'Aguardando pagamento PIX',
          description:
            'Escaneie o QR Code ou copie o código PIX. Assim que o pagamento for confirmado, a entrega será iniciada.',
          badge: 'PIX pendente',
          tone: 'warning',
          canRetryPayment: false,
          canSimulateInMock: true,
        };
      case 'payment_confirmed':
      case 'delivery_processing':
        return {
          headline: 'Pagamento confirmado',
          description: 'Pagamento reconhecido. A entrega do item está em processamento.',
          badge: 'Entrega em andamento',
          tone: 'info',
          canRetryPayment: false,
          canSimulateInMock: false,
        };
      case 'delivered':
        return {
          headline: 'Item entregue',
          description: 'Pagamento confirmado e item entregue no personagem informado.',
          badge: 'Concluído',
          tone: 'success',
          canRetryPayment: false,
          canSimulateInMock: false,
        };
      case 'delivery_pending_manual_action':
        return {
          headline: 'Pagamento confirmado',
          description: 'O pedido foi pago, mas a entrega final depende de backend real para concluir.',
          badge: 'Entrega pendente',
          tone: 'warning',
          canRetryPayment: false,
          canSimulateInMock: false,
        };
      case 'failed':
        return {
          headline: 'Falha no pedido',
          description: 'O pedido não pode ser concluído automaticamente neste fluxo do MVP.',
          badge: 'Falha',
          tone: 'warning',
          canRetryPayment: true,
          canSimulateInMock: false,
        };
      case 'checkout_ready':
      default:
        return {
          headline: 'Revise os dados e gere o PIX',
          description: 'Confira personagem, realm e e-mail antes de seguir para o pagamento.',
          badge: 'Checkout',
          tone: 'info',
          canRetryPayment: false,
          canSimulateInMock: false,
        };
    }
  }

  buildQrMatrix(payload: string): readonly (readonly boolean[])[] {
    const size = 21;
    const cells = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));

    const placeFinder = (startRow: number, startColumn: number): void => {
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          const isBorder = row === 0 || row === 6 || column === 0 || column === 6;
          const isCore = row >= 2 && row <= 4 && column >= 2 && column <= 4;
          cells[startRow + row][startColumn + column] = isBorder || isCore;
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    let seed = 0;

    for (const character of payload) {
      seed = (seed * 31 + character.charCodeAt(0)) % 2147483647;
    }

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (cells[row][column] !== null) {
          continue;
        }

        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        cells[row][column] = seed % 2 === 0;
      }
    }

    return cells.map((row) => row.map((cell) => Boolean(cell)));
  }

  private createOrderItem(product: CatalogProduct, quantity: number): OrderItem {
    return {
      sku: product.sku,
      name: product.name,
      icon: product.icon,
      category: product.category,
      quantity,
      unitPriceInBrl: product.priceInBrl,
      totalPriceInBrl: product.priceInBrl * quantity,
    };
  }

  private updateOrderStatus(
    order: MarketplaceOrder,
    status: OrderStatus,
    ...entries: TimelineEntry[]
  ): MarketplaceOrder {
    return {
      ...order,
      status,
      updatedAt: entries.at(-1)?.createdAt ?? new Date().toISOString(),
      timeline: [...order.timeline, ...entries],
    };
  }

  private runDelivery(order: MarketplaceOrder, requestedAt: string): DeliveryRecord {
    const command: DeliveryCommand = {
      commandId: `DL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      orderId: order.id,
      characterName: order.buyer.characterName,
      realm: order.buyer.realm,
      sku: order.item.sku,
      quantity: order.item.quantity,
      requestedAt,
      strategy: 'inventory-grant',
    };

    if (order.metadata.automationMode === 'backend_pending') {
      const attempt = this.deliveryAttempt(
        'success',
        `Pagamento confirmado para ${order.buyer.characterName}. A entrega final do item ${order.item.name} depende de backend real no realm ${order.buyer.realm}.`,
      );

      return {
        orderId: order.id,
        status: 'pending_manual_action',
        mode: 'backend_pending',
        processor: 'mock-game-delivery-adapter',
        command,
        attempts: [attempt],
        lastUpdatedAt: attempt.processedAt,
        resultMessage: attempt.message,
      };
    }

    const attempt = this.deliveryAttempt(
      'success',
      `Item ${order.item.name} x${order.item.quantity} entregue automaticamente para ${order.buyer.characterName} no realm ${order.buyer.realm}.`,
    );

    return {
      orderId: order.id,
      status: 'delivered',
      mode: 'mock_auto_delivered',
      processor: 'mock-game-delivery-adapter',
      command,
      attempts: [attempt],
      lastUpdatedAt: attempt.processedAt,
      resultMessage: attempt.message,
    };
  }

  private deliveryAttempt(status: DeliveryAttempt['status'], message: string): DeliveryAttempt {
    return {
      attemptId: `AT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status,
      processedAt: new Date().toISOString(),
      message,
    };
  }

  private buildPersistencePreview(
    order: MarketplaceOrder,
    payment: PaymentRecord,
    webhook: WorkflowState['webhook'],
    delivery: DeliveryRecord | null,
  ): PersistencePreview {
    return {
      database: marketplacePersistenceConfig.database,
      collections: marketplacePersistenceConfig.collections,
      documents: {
        order: {
          orderId: order.id,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          characterName: order.buyer.characterName,
          realm: order.buyer.realm,
          email: order.buyer.email,
          item: order.item,
          source: order.source,
          timeline: order.timeline,
          automationMode: order.metadata.automationMode,
        },
        payment: {
          orderId: payment.orderId,
          provider: payment.provider,
          checkoutId: payment.checkoutId,
          transactionReference: payment.transactionReference,
          amountInBrl: payment.amountInBrl,
          status: payment.status,
          createdAt: payment.createdAt,
          confirmedAt: payment.confirmedAt,
          mode: payment.mode,
        },
        webhook: webhook
          ? {
              provider: webhook.provider,
              status: webhook.status,
              receivedAt: webhook.receivedAt,
              event: webhook.event,
            }
          : {
              provider: 'PixGo',
              status: 'awaiting-webhook',
            },
        delivery: delivery
          ? {
              orderId: delivery.orderId,
              status: delivery.status,
              mode: delivery.mode,
              processor: delivery.processor,
              command: delivery.command,
              attempts: delivery.attempts,
              resultMessage: delivery.resultMessage,
            }
          : {
              orderId: order.id,
              status: 'awaiting-payment',
            },
      },
    };
  }

  private timelineEntry(
    type: TimelineEntry['type'],
    title: string,
    description: string,
    createdAt: string,
    status: TimelineEntry['status'],
  ): TimelineEntry {
    return {
      id: `${type}-${crypto.randomUUID().slice(0, 6)}`,
      type,
      title,
      description,
      createdAt,
      status,
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
