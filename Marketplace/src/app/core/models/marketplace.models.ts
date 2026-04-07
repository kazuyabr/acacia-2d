export type MarketplaceStep = 'catalog' | 'checkout' | 'payment';

export type ProductCategory = 'consumable' | 'weapon-skin' | 'character-skin' | 'pet' | 'bundle';

export type OrderStatus =
  | 'checkout_ready'
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'delivery_processing'
  | 'delivered'
  | 'delivery_pending_manual_action'
  | 'failed';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export type DeliveryStatus = 'processing' | 'delivered' | 'pending_manual_action' | 'failed';

export type DeliveryMode = 'mock_auto_delivered' | 'backend_pending' | 'failed';

export type PixIntegrationMode = 'mock' | 'pixgo-hosted-checkout' | 'pixgo-webhook-contract';

export type WebhookProcessingStatus = 'received' | 'accepted' | 'ignored';

export interface CatalogProduct {
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly typeLabel: string;
  readonly description: string;
  readonly shortDescription: string;
  readonly icon: string;
  readonly supportedRealms: readonly string[];
  readonly realmLabel: string;
  readonly deliveryLabel: string;
  readonly priceInBrl: number;
  readonly tags: readonly string[];
  readonly supportsQuantity: boolean;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly deliveryMode: Exclude<DeliveryMode, 'failed'>;
}

export interface CheckoutForm {
  characterName: string;
  realm: string;
  email: string;
  quantity: number;
}

export interface BuyerProfile {
  readonly characterName: string;
  readonly realm: string;
  readonly email: string;
}

export interface OrderItem {
  readonly sku: string;
  readonly name: string;
  readonly icon: string;
  readonly category: ProductCategory;
  readonly quantity: number;
  readonly unitPriceInBrl: number;
  readonly totalPriceInBrl: number;
}

export interface CheckoutSummary {
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPriceInBrl: number;
  readonly subtotalInBrl: number;
  readonly totalInBrl: number;
  readonly characterName: string;
  readonly realm: string;
  readonly email: string;
  readonly deliveryTarget: string;
}

export interface MarketplaceOrder {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: OrderStatus;
  readonly buyer: BuyerProfile;
  readonly item: OrderItem;
  readonly source: 'marketplace-web';
  readonly timeline: readonly TimelineEntry[];
  readonly metadata: {
    readonly realm: string;
    readonly automationMode: DeliveryMode;
    readonly notes: string;
  };
}

export interface PixCharge {
  readonly provider: 'PixGo';
  readonly checkoutId: string;
  readonly transactionReference: string;
  readonly qrCodePayload: string;
  readonly qrCodeEmv: string;
  readonly amountInBrl: number;
  readonly expiresAt: string;
  readonly status: PaymentStatus;
  readonly mode: PixIntegrationMode;
  readonly checkoutUrl: string;
  readonly instructions: readonly string[];
}

export interface PaymentRecord {
  readonly orderId: string;
  readonly provider: 'PixGo';
  readonly checkoutId: string;
  readonly transactionReference: string;
  readonly amountInBrl: number;
  readonly status: PaymentStatus;
  readonly mode: PixIntegrationMode;
  readonly createdAt: string;
  readonly confirmedAt: string | null;
  readonly rawWebhookEvent: PixGoWebhookEvent | null;
}

export interface PixGoWebhookEvent {
  readonly eventId: string;
  readonly eventType: 'payment.confirmed';
  readonly provider: 'PixGo';
  readonly occurredAt: string;
  readonly checkoutId: string;
  readonly transactionReference: string;
  readonly orderId: string;
  readonly amountInBrl: number;
  readonly payloadMode: 'mock';
  readonly payload: { [key: string]: unknown };
}

export interface WebhookReceipt {
  readonly provider: 'PixGo';
  readonly status: WebhookProcessingStatus;
  readonly receivedAt: string;
  readonly event: PixGoWebhookEvent;
}

export interface DeliveryCommand {
  readonly commandId: string;
  readonly orderId: string;
  readonly characterName: string;
  readonly realm: string;
  readonly sku: string;
  readonly quantity: number;
  readonly requestedAt: string;
  readonly strategy: 'inventory-grant';
}

export interface DeliveryRecord {
  readonly orderId: string;
  readonly status: DeliveryStatus;
  readonly mode: DeliveryMode;
  readonly processor: 'mock-game-delivery-adapter';
  readonly command: DeliveryCommand;
  readonly attempts: readonly DeliveryAttempt[];
  readonly lastUpdatedAt: string;
  readonly resultMessage: string;
}

export interface DeliveryAttempt {
  readonly attemptId: string;
  readonly status: 'success' | 'failed';
  readonly processedAt: string;
  readonly message: string;
}

export interface PersistencePreview {
  readonly database: string;
  readonly collections: {
    readonly orders: string;
    readonly payments: string;
    readonly webhooks: string;
    readonly deliveries: string;
  };
  readonly documents: {
    readonly order: { [key: string]: unknown };
    readonly payment: { [key: string]: unknown };
    readonly webhook: { [key: string]: unknown };
    readonly delivery: { [key: string]: unknown };
  };
}

export interface TimelineEntry {
  readonly id: string;
  readonly type:
    | 'order.created'
    | 'payment.checkout_created'
    | 'webhook.received'
    | 'payment.confirmed'
    | 'delivery.started'
    | 'delivery.completed'
    | 'delivery.failed';
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly status: 'done' | 'active' | 'warning';
}

export interface OrderStatusViewModel {
  readonly headline: string;
  readonly description: string;
  readonly badge: string;
  readonly tone: 'info' | 'success' | 'warning';
  readonly canRetryPayment: boolean;
  readonly canSimulateInMock: boolean;
}

export interface WorkflowState {
  readonly order: MarketplaceOrder | null;
  readonly charge: PixCharge | null;
  readonly payment: PaymentRecord | null;
  readonly webhook: WebhookReceipt | null;
  readonly delivery: DeliveryRecord | null;
  readonly persistence: PersistencePreview | null;
}

export interface RealCatalogItem {
  readonly id: number;
  readonly itemId: string;
  readonly name: string;
  readonly imageKey: string | null;
  readonly imagePath: string | null;
  readonly imageSource: string | null;
  readonly category: string;
  readonly subcategory: string | null;
  readonly requiredSkill: string | null;
  readonly requiredLevel: number | null;
  readonly weaponType: string | null;
  readonly attackStats: { [key: string]: unknown };
  readonly defenseStats: { [key: string]: unknown };
  readonly bonuses: { [key: string]: unknown };
  readonly statusSummary: { [key: string]: unknown };
  readonly description: string | null;
  readonly stackable: boolean;
  readonly maxStack: number;
  readonly projectileName: string | null;
  readonly metadataRaw: { [key: string]: unknown };
  readonly metadataGame: { [key: string]: unknown };
  readonly canSell: boolean;
  readonly priceBrl: number | null;
  readonly isImageMapped: boolean;
  readonly lastImportedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RealCatalogStats {
  readonly totalItems: number;
  readonly sellableItems: number;
  readonly hiddenItems: number;
  readonly mappedImages: number;
  readonly missingImages: number;
  readonly distinctCategories: number;
  readonly lastImportedAt: string | null;
}

export interface RealCatalogResponse {
  readonly source: {
    readonly primary: string;
    readonly mode: 'catalog_table' | 'sellable_view';
    readonly bootstrap: string;
  };
  readonly filters: {
    readonly searchTerm: string;
    readonly category: string;
    readonly requiredSkill: string;
    readonly limit: number;
    readonly hasImage?: boolean;
  };
  readonly stats: RealCatalogStats;
  readonly items: readonly RealCatalogItem[];
}
