import { MARKETPLACE_PRODUCTS } from '../../features/catalog/catalog.data';

import { Injectable } from '@angular/core';

import type {
  CatalogProduct,
  ProductCategory,
  RealCatalogItem,
  RealCatalogResponse,
} from '../models/marketplace.models';

type MarketplaceRuntimeConfig = {
  readonly gameApiBaseUrl?: string;
};

const DEFAULT_GAME_API_BASE_URL = 'http://localhost:9001',
  FALLBACK_REALM = 'main-world',
  CATEGORY_MAP: Readonly<{ [key: string]: ProductCategory }> = {
    consumable: 'consumable',
  },
  REALM_TAGS = ['main-world', 'seasonal-world', 'test-world'] as const;

@Injectable({ providedIn: 'root' })
export class RealCatalogService {
  async fetchCatalog(limit = 200): Promise<RealCatalogResponse> {
    const apiBaseUrl = this.resolveGameApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/catalog/items?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Falha ao carregar catálogo da API do jogo: ${response.status}`);
    }

    return (await response.json()) as RealCatalogResponse;
  }

  getGameApiBaseUrl(): string {
    return this.resolveGameApiBaseUrl();
  }

  getFallbackCatalog(): readonly CatalogProduct[] {
    return MARKETPLACE_PRODUCTS;
  }

  mapToProducts(response: RealCatalogResponse): readonly CatalogProduct[] {
    return response.items.map((item) => this.mapItemToProduct(item));
  }

  private mapItemToProduct(item: RealCatalogItem): CatalogProduct {
    const category = this.resolveCategory(item);
    const realms = this.resolveSupportedRealms(item);
    const priceInBrl = item.priceBrl ?? this.estimatePriceInBrl(item);
    const deliveryMode: CatalogProduct['deliveryMode'] =
      item.canSell && item.priceBrl !== null ? 'backend_pending' : 'mock_auto_delivered';

    return {
      sku: item.itemId,
      name: item.name,
      category,
      typeLabel: this.buildTypeLabel(item),
      description: item.description?.trim() || this.buildDescription(item),
      shortDescription: this.buildShortDescription(item),
      icon: this.resolveIcon(item, category),
      supportedRealms: realms,
      realmLabel: this.buildRealmLabel(realms),
      deliveryLabel:
        item.canSell && item.priceBrl !== null
          ? 'Catálogo comercial retornado pela API do jogo'
          : 'Catálogo base da API do jogo pronto para curadoria comercial',
      priceInBrl,
      tags: this.buildTags(item),
      supportsQuantity: item.stackable || item.maxStack > 1,
      minQuantity: 1,
      maxQuantity: item.stackable ? Math.min(Math.max(item.maxStack, 1), 99) : 1,
      deliveryMode,
    };
  }

  private resolveCategory(item: RealCatalogItem): ProductCategory {
    return CATEGORY_MAP[item.category] ?? 'bundle';
  }

  private resolveSupportedRealms(item: RealCatalogItem): readonly string[] {
    const metadataGameRealm = item.metadataGame?.['realm'];
    const metadataGameWorld = item.metadataGame?.['world'];
    const metadataRawRealm = item.metadataRaw?.['realm'];
    const metadataRawWorld = item.metadataRaw?.['world'];
    const metadataGameRealms = item.metadataGame?.['realms'];
    const metadataRawRealms = item.metadataRaw?.['realms'];
    const realmCandidates = [
      metadataGameRealm,
      metadataGameWorld,
      metadataRawRealm,
      metadataRawWorld,
      ...(Array.isArray(metadataGameRealms) ? metadataGameRealms : []),
      ...(Array.isArray(metadataRawRealms) ? metadataRawRealms : []),
      ...this.extractRealmTags(item),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase());
    const uniqueRealms = [...new Set(realmCandidates)];

    return uniqueRealms.length > 0 ? uniqueRealms : [FALLBACK_REALM];
  }

  private extractRealmTags(item: RealCatalogItem): readonly string[] {
    const searchable = JSON.stringify({
      metadataGame: item.metadataGame,
      metadataRaw: item.metadataRaw,
      description: item.description,
      subcategory: item.subcategory,
    }).toLowerCase();

    return REALM_TAGS.filter((realm) => searchable.includes(realm));
  }

  private buildTypeLabel(item: RealCatalogItem): string {
    if (item.requiredSkill) {
      return `${this.toLabel(item.category)} • ${this.toLabel(item.requiredSkill)}`;
    }

    if (item.subcategory) {
      return `${this.toLabel(item.category)} • ${this.toLabel(item.subcategory)}`;
    }

    return this.toLabel(item.category);
  }

  private buildDescription(item: RealCatalogItem): string {
    const details = [
      item.requiredSkill ? `Skill: ${this.toLabel(item.requiredSkill)}` : null,
      item.requiredLevel === null ? null : `Nível mínimo ${item.requiredLevel}`,
      item.weaponType ? `Tipo ${this.toLabel(item.weaponType)}` : null,
      item.isImageMapped ? 'sprite validada' : 'sprite pendente de auditoria',
    ].filter(Boolean);

    return details.join(' • ');
  }

  private buildShortDescription(item: RealCatalogItem): string {
    return (
      item.description?.trim() ||
      `Item real importado do jogo na categoria ${this.toLabel(item.category)}.`
    );
  }

  private buildRealmLabel(realms: readonly string[]): string {
    return realms.length === 1
      ? `Exclusivo para ${realms[0]}`
      : `Compatível com ${realms.join(', ')}`;
  }

  private buildTags(item: RealCatalogItem): readonly string[] {
    const rawTags = [
      item.category,
      item.subcategory,
      item.requiredSkill,
      item.weaponType,
      item.stackable ? 'stackable' : 'unitário',
      item.isImageMapped ? 'sprite ok' : 'sprite pendente',
      ...this.resolveSupportedRealms(item),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return [...new Set(rawTags.map((value) => this.toLabel(value)))];
  }

  private resolveIcon(item: RealCatalogItem, category: ProductCategory): string {
    if (item.imageKey) {
      return item.imageKey.slice(0, 2).toUpperCase();
    }

    switch (category) {
      case 'consumable':
        return '🧪';
      case 'weapon-skin':
        return '🗡️';
      case 'character-skin':
        return '🥷';
      case 'pet':
        return '🦊';
      default:
        return '📦';
    }
  }

  private estimatePriceInBrl(item: RealCatalogItem): number {
    const levelFactor = item.requiredLevel ? Math.min(item.requiredLevel, 100) * 0.35 : 0;
    const statFactor =
      Object.keys(item.attackStats || {}).length + Object.keys(item.defenseStats || {}).length;
    const metadataFactor = item.stackable ? Math.min(item.maxStack, 20) * 0.1 : 1;
    const estimated = 9.9 + levelFactor + statFactor * 1.25 + metadataFactor;

    return Number(estimated.toFixed(2));
  }

  private resolveGameApiBaseUrl(): string {
    const runtimeConfig = (
      globalThis as typeof globalThis & {
        __MARKETPLACE_RUNTIME_CONFIG__?: MarketplaceRuntimeConfig;
      }
    ).__MARKETPLACE_RUNTIME_CONFIG__;
    const configuredUrl = runtimeConfig?.gameApiBaseUrl?.trim();

    return configuredUrl?.replace(/\/$/, '') || DEFAULT_GAME_API_BASE_URL;
  }

  private toLabel(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  }
}
