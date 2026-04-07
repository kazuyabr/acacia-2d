import { CurrencyPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type {
  CatalogProduct,
  CheckoutForm,
  CheckoutSummary,
  OrderStatusViewModel,
  ProductCategory,
  WorkflowState,
} from './core/models/marketplace.models';
import { MarketplaceWorkflowService } from './core/services/marketplace-workflow.service';
import { RealCatalogService } from './core/services/real-catalog.service';

type PurchaseStage = {
  readonly id: 'catalog' | 'checkout' | 'payment' | 'delivery';
  readonly order: number;
  readonly label: string;
  readonly helper: string;
  readonly state: 'done' | 'active' | 'upcoming';
};

type CategoryOption = {
  readonly value: ProductCategory;
  readonly label: string;
};

type CatalogHighlight = {
  readonly title: string;
  readonly value: string;
  readonly helper: string;
};

type CategoryChip = {
  readonly value: ProductCategory | 'all';
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
};

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 'consumable', label: 'Consumíveis' },
  { value: 'weapon-skin', label: 'Skins de arma' },
  { value: 'character-skin', label: 'Skins de personagem' },
  { value: 'pet', label: 'Pets' },
  { value: 'bundle', label: 'Bundles' },
];

const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  characterName: '',
  realm: '',
  email: '',
  quantity: 1,
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly realCatalog = inject(RealCatalogService);

  protected readonly workflow = new MarketplaceWorkflowService();
  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly products = signal<readonly CatalogProduct[]>([]);
  protected readonly catalogSourceLabel = signal('API do jogo');
  protected readonly gameApiBaseUrl = this.realCatalog.getGameApiBaseUrl();
  protected readonly isCatalogLoading = signal(true);
  protected readonly catalogLoadError = signal<string | null>(null);
  protected readonly usingCatalogFallback = signal(false);

  protected readonly searchTerm = signal('');
  protected readonly selectedCategoryFilter = signal<ProductCategory | 'all'>('all');
  protected readonly selectedRealmFilter = signal('all');
  protected readonly selectedTypeFilter = signal('all');

  protected readonly selectedProduct = signal<CatalogProduct | null>(null);
  protected readonly checkoutForm = signal<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  protected readonly workflowState = signal<WorkflowState>({
    order: null,
    charge: null,
    payment: null,
    webhook: null,
    delivery: null,
    persistence: null,
  });

  constructor() {
    void this.loadCatalog();
  }

  protected readonly realmOptions = computed<readonly string[]>(() => {
    const realms = this.products().flatMap((product) => product.supportedRealms);
    return Array.from(new Set(realms));
  });

  protected readonly typeOptions = computed<readonly string[]>(() => {
    const types = this.products().map((product) => product.typeLabel);
    return Array.from(new Set(types));
  });

  protected readonly filteredProducts = computed<readonly CatalogProduct[]>(() =>
    this.products().filter((product) => this.matchesCatalogFilters(product)),
  );

  protected readonly categoryChips = computed<readonly CategoryChip[]>(() => {
    const searchableProducts = this.products().filter((product) =>
      this.matchesCatalogFilters(product, { category: 'all' }),
    );

    return [
      {
        value: 'all',
        label: 'Todos',
        count: searchableProducts.length,
        active: this.selectedCategoryFilter() === 'all',
      },
      ...this.categoryOptions.map((category) => ({
        value: category.value,
        label: category.label,
        count: searchableProducts.filter((product) => product.category === category.value).length,
        active: this.selectedCategoryFilter() === category.value,
      })),
    ];
  });

  protected readonly totalProducts = computed(() => this.products().length);
  protected readonly filteredCount = computed(() => this.filteredProducts().length);

  protected readonly visibleCategoryCount = computed(
    () => this.categoryChips().filter((chip) => chip.value !== 'all' && chip.count > 0).length,
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.selectedCategoryFilter() !== 'all' ||
      this.selectedRealmFilter() !== 'all' ||
      this.selectedTypeFilter() !== 'all',
  );

  protected readonly catalogHighlights = computed<readonly CatalogHighlight[]>(() => [
    {
      title: 'Produtos visíveis',
      value: String(this.filteredCount()),
      helper: `de ${this.totalProducts()} itens disponíveis na vitrine`,
    },
    {
      title: 'Fonte principal',
      value: this.usingCatalogFallback() ? 'Fallback mockado' : 'API do jogo',
      helper: this.usingCatalogFallback()
        ? 'fallback acionado apenas se a API do jogo falhar'
        : `catálogo base carregado da API do jogo em ${this.gameApiBaseUrl}`,
    },
    {
      title: 'Checkout',
      value: this.selectedProduct() ? 'Aberto' : 'Sob demanda',
      helper: this.selectedProduct()
        ? `painel ativo para ${this.selectedProduct()?.name}`
        : 'aparece apenas depois da seleção do produto',
    },
  ]);

  protected readonly catalogSummaryLabel = computed(() => {
    if (this.isCatalogLoading()) {
      return `Carregando catálogo principal a partir da API do jogo em ${this.gameApiBaseUrl}.`;
    }

    if (!this.filteredCount()) {
      return 'Nenhum item encontrado com os filtros atuais';
    }

    if (!this.hasActiveFilters()) {
      return `Mostrando ${this.filteredCount()} produtos da ${this.catalogSourceLabel()} para explorar com calma.`;
    }

    return `${this.filteredCount()} produtos encontrados para a combinação atual de filtros.`;
  });

  protected readonly suggestionProduct = computed<CatalogProduct | null>(() => {
    const selected = this.selectedProduct();
    return this.filteredProducts().find((product) => product.sku !== selected?.sku) ?? null;
  });

  protected readonly selectedSku = computed(() => this.selectedProduct()?.sku ?? null);
  protected readonly activeOrder = computed(() => this.workflowState().order);
  protected readonly activeCharge = computed(() => this.workflowState().charge);
  protected readonly activeDelivery = computed(() => this.workflowState().delivery);
  protected readonly hasActiveOrder = computed(() => Boolean(this.activeOrder() && this.activeCharge()));

  protected readonly checkoutSummary = computed<CheckoutSummary | null>(() => {
    const product = this.selectedProduct();
    if (!product) {
      return null;
    }

    return this.workflow.createSummary(product, this.checkoutForm());
  });

  protected readonly paymentStatus = computed<OrderStatusViewModel>(() =>
    this.workflow.getStatusViewModel(this.workflowState()),
  );

  protected readonly availableRealms = computed<readonly string[]>(() => {
    const product = this.selectedProduct();
    return product ? this.workflow.getAvailableRealms(product) : [];
  });

  protected readonly quantityEnabled = computed(() => this.selectedProduct()?.supportsQuantity ?? false);

  protected readonly selectedProductRealms = computed(() => {
    const product = this.selectedProduct();
    return product ? this.formatRealmList(product.supportedRealms) : '';
  });

  protected readonly purchaseStages = computed<readonly PurchaseStage[]>(() => {
    const product = this.selectedProduct();
    const hasCharge = this.hasActiveOrder();
    const isDelivered = Boolean(this.activeDelivery());

    return [
      {
        id: 'catalog',
        order: 1,
        label: 'Escolha o item',
        helper: product ? 'Produto selecionado na vitrine.' : 'Explore o catálogo e selecione um produto.',
        state: product ? 'done' : 'active',
      },
      {
        id: 'checkout',
        order: 2,
        label: 'Preencha os dados',
        helper: hasCharge
          ? 'Dados do pedido já confirmados.'
          : product
            ? 'Informe realm, personagem e e-mail.'
            : 'Checkout disponível após escolher o item.',
        state: hasCharge ? 'done' : product ? 'active' : 'upcoming',
      },
      {
        id: 'payment',
        order: 3,
        label: 'Pague via PIX',
        helper: isDelivered
          ? 'Pagamento concluído.'
          : hasCharge
            ? 'PIX pronto para copiar ou escanear.'
            : 'O PIX aparece depois do checkout.',
        state: isDelivered ? 'done' : hasCharge ? 'active' : 'upcoming',
      },
      {
        id: 'delivery',
        order: 4,
        label: 'Receba o item',
        helper: isDelivered
          ? 'Entrega exibida abaixo.'
          : hasCharge
            ? 'Aguardando confirmação do pagamento.'
            : 'Entrega após confirmação do PIX.',
        state: isDelivered ? 'active' : 'upcoming',
      },
    ];
  });

  protected readonly checkoutError = computed<string | null>(() => {
    const product = this.selectedProduct();
    if (!product || this.hasActiveOrder()) {
      return null;
    }

    return this.workflow.getCheckoutValidationMessage(product, this.checkoutForm());
  });

  protected readonly qrCodeMatrix = computed<readonly (readonly boolean[])[]>(() => {
    const payload = this.activeCharge()?.qrCodePayload;
    return payload ? this.workflow.buildQrMatrix(payload) : [];
  });

  protected updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  protected updateCategoryFilter(value: ProductCategory | 'all'): void {
    this.selectedCategoryFilter.set(value);
  }

  protected updateRealmFilter(value: string): void {
    this.selectedRealmFilter.set(value);
  }

  protected updateTypeFilter(value: string): void {
    this.selectedTypeFilter.set(value);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategoryFilter.set('all');
    this.selectedRealmFilter.set('all');
    this.selectedTypeFilter.set('all');
  }

  protected async reloadCatalog(): Promise<void> {
    await this.loadCatalog();
  }

  protected selectProduct(product: CatalogProduct): void {
    const previous = this.checkoutForm();

    this.selectedProduct.set(product);
    this.checkoutForm.set(this.workflow.createCheckoutForm(product, previous));
    this.resetWorkflowState();
  }

  protected closeProductPanel(): void {
    this.selectedProduct.set(null);
    this.checkoutForm.set(EMPTY_CHECKOUT_FORM);
    this.resetWorkflowState();
  }

  protected updateField<K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]): void {
    const product = this.selectedProduct();
    if (!product) {
      return;
    }

    const current = this.checkoutForm();
    const next = {
      ...current,
      [field]: value,
    } as CheckoutForm;

    if (field === 'realm' && !this.workflow.isRealmSupported(product, String(value))) {
      next.realm = this.availableRealms()[0] ?? '';
    }

    if (field === 'quantity') {
      next.quantity = this.workflow.normalizeQuantity(product, Number(value));
    }

    this.checkoutForm.set(next);
  }

  protected changeQuantity(direction: -1 | 1): void {
    const product = this.selectedProduct();
    if (!product) {
      return;
    }

    const current = this.checkoutForm();
    const nextQuantity = this.workflow.normalizeQuantity(product, current.quantity + direction);

    this.checkoutForm.set({
      ...current,
      quantity: nextQuantity,
    });
  }

  protected createOrder(): void {
    const product = this.selectedProduct();
    if (!product || !this.workflow.isCheckoutValid(product, this.checkoutForm())) {
      return;
    }

    const draftOrder = this.workflow.createDraftOrder(product, this.checkoutForm());
    const state = this.workflow.startPayment(draftOrder);

    this.workflowState.set(state);
  }

  protected simulatePaymentConfirmation(): void {
    const confirmedState = this.workflow.confirmPayment(this.workflowState());
    this.workflowState.set(confirmedState);
  }

  protected resetPurchase(): void {
    const product = this.selectedProduct();
    this.checkoutForm.set(product ? this.workflow.createCheckoutForm(product) : EMPTY_CHECKOUT_FORM);
    this.resetWorkflowState();
  }

  protected chooseAnotherProduct(): void {
    this.closeProductPanel();
  }

  protected isRealmLocked(): boolean {
    return this.availableRealms().length === 1;
  }

  protected getCategoryLabel(category: ProductCategory): string {
    const option = this.categoryOptions.find((entry) => entry.value === category);
    return option?.label ?? category;
  }

  protected formatRealmList(realms: readonly string[]): string {
    if (realms.length <= 1) {
      return realms[0] ?? 'Sem realm';
    }

    if (realms.length === 2) {
      return `${realms[0]} e ${realms[1]}`;
    }

    const lastRealm = realms[realms.length - 1] ?? '';
    return `${realms.slice(0, -1).join(', ')} e ${lastRealm}`;
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }

  protected trackProduct(_: number, product: CatalogProduct): string {
    return product.sku;
  }

  protected trackStage(_: number, stage: PurchaseStage): string {
    return stage.id;
  }

  protected trackCategoryChip(_: number, chip: CategoryChip): ProductCategory | 'all' {
    return chip.value;
  }

  private async loadCatalog(): Promise<void> {
    this.isCatalogLoading.set(true);
    this.catalogLoadError.set(null);

    try {
      const response = await this.realCatalog.fetchCatalog();
      const products = this.realCatalog.mapToProducts(response);

      this.products.set(products);
      this.catalogSourceLabel.set(`API do jogo (${this.gameApiBaseUrl})`);
      this.usingCatalogFallback.set(false);
      this.ensureSelectedProductStillExists();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Falha ao consultar a API do jogo em ${this.gameApiBaseUrl}.`;

      this.products.set(this.realCatalog.getFallbackCatalog());
      this.catalogSourceLabel.set('fallback mockado');
      this.catalogLoadError.set(
        `${message} O fallback local foi ativado apenas para manter a UI operável.`,
      );
      this.usingCatalogFallback.set(true);
      this.ensureSelectedProductStillExists();
    } finally {
      this.isCatalogLoading.set(false);
    }
  }

  private ensureSelectedProductStillExists(): void {
    const currentSelectedProduct = this.selectedProduct();
    if (!currentSelectedProduct) {
      return;
    }

    const nextSelectedProduct =
      this.products().find((product) => product.sku === currentSelectedProduct.sku) ?? null;

    if (!nextSelectedProduct) {
      this.closeProductPanel();
      return;
    }

    if (nextSelectedProduct !== currentSelectedProduct) {
      const previous = this.checkoutForm();
      this.selectedProduct.set(nextSelectedProduct);
      this.checkoutForm.set(this.workflow.createCheckoutForm(nextSelectedProduct, previous));
    }
  }

  private matchesCatalogFilters(
    product: CatalogProduct,
    overrides?: {
      readonly category?: ProductCategory | 'all';
      readonly realm?: string;
      readonly type?: string;
      readonly term?: string;
    },
  ): boolean {
    const term = (overrides?.term ?? this.searchTerm()).trim().toLowerCase();
    const category = overrides?.category ?? this.selectedCategoryFilter();
    const realm = overrides?.realm ?? this.selectedRealmFilter();
    const type = overrides?.type ?? this.selectedTypeFilter();

    const matchesSearch =
      !term ||
      [
        product.name,
        product.typeLabel,
        product.shortDescription,
        product.description,
        product.deliveryLabel,
        product.realmLabel,
        ...product.tags,
      ].some((value) => value.toLowerCase().includes(term));

    const matchesCategory = category === 'all' || product.category === category;
    const matchesRealm = realm === 'all' || product.supportedRealms.includes(realm);
    const matchesType = type === 'all' || product.typeLabel === type;

    return matchesSearch && matchesCategory && matchesRealm && matchesType;
  }

  private resetWorkflowState(): void {
    this.workflowState.set({
      order: null,
      charge: null,
      payment: null,
      webhook: null,
      delivery: null,
      persistence: null,
    });
  }
}
