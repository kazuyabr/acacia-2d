import {
  getGameItemsSourceLabel,
  getSpritesSourceLabel,
  resolveMarketplaceImageData,
} from './game-items-source.js';

const STATUS_KEYS = [
  'accuracy',
  'strength',
  'archery',
  'magic',
  'crush',
  'slash',
  'stab',
  'attack_rate',
  'attack_range',
  'movement_modifier',
  'heal_amount',
  'heal_percent',
  'mana_amount',
  'mana_cost',
  'lumberjacking',
  'mining',
  'fishing',
];

function toIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  let normalized = Number(value);

  return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
}

function toBoolean(value) {
  return value === true;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => sortObject(entry));
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
}

function buildStatusSummary(itemData) {
  let attackStats = normalizeObject(itemData.attackStats),
    defenseStats = normalizeObject(itemData.defenseStats),
    bonuses = normalizeObject(itemData.bonuses),
    summary = {
      attack: sortObject(attackStats),
      defense: sortObject(defenseStats),
      bonuses: sortObject(bonuses),
    };

  if (bonuses.accuracy !== undefined) summary.accuracy = bonuses.accuracy;
  if (bonuses.strength !== undefined) summary.strength = bonuses.strength;
  if (bonuses.archery !== undefined) summary.archery = bonuses.archery;
  if (bonuses.magic !== undefined) summary.magic = bonuses.magic;

  if (itemData.attackRate !== undefined) summary.attack_rate = itemData.attackRate;
  if (itemData.attackRange !== undefined) summary.attack_range = itemData.attackRange;
  if (itemData.movementModifier !== undefined)
    summary.movement_modifier = itemData.movementModifier;
  if (itemData.healAmount !== undefined) summary.heal_amount = itemData.healAmount;
  if (itemData.healPercent !== undefined) summary.heal_percent = itemData.healPercent;
  if (itemData.manaAmount !== undefined) summary.mana_amount = itemData.manaAmount;
  if (itemData.manaCost !== undefined) summary.mana_cost = itemData.manaCost;
  if (itemData.lumberjacking !== undefined) summary.lumberjacking = itemData.lumberjacking;
  if (itemData.mining !== undefined) summary.mining = itemData.mining;
  if (itemData.fishing !== undefined) summary.fishing = itemData.fishing;
  if (itemData.pet !== undefined) summary.pet = itemData.pet;

  return sortObject(summary);
}

function buildMetadataGame(gameItemKey, itemData, imageData, statusSummary) {
  return sortObject({
    item_id: gameItemKey,
    source_origin: getGameItemsSourceLabel(),
    image_source: getSpritesSourceLabel(),
    sprite_name: itemData.spriteName ?? null,
    resolved_image_key: imageData.imageKey,
    resolved_image_path: imageData.imagePath,
    image_mapping: imageData.isImageMapped ? 'mapped' : 'fallback',
    stackable: toBoolean(itemData.stackable),
    max_stack: Math.max(1, Number(itemData.maxStackSize || 1)),
    edible: toBoolean(itemData.edible),
    interactable: toBoolean(itemData.interactable),
    two_handed: toBoolean(itemData.twoHanded),
    poisonous: toBoolean(itemData.poisonous),
    freezing: toBoolean(itemData.freezing),
    burning: toBoolean(itemData.burning),
    undroppable: toBoolean(itemData.undroppable),
    achievement: itemData.achievement ?? null,
    quest: itemData.quest ?? null,
    plugin: itemData.plugin ?? null,
    price_game: itemData.price ?? null,
    store_count: itemData.storeCount ?? null,
    projectile_name: itemData.projectileName ?? null,
    effect: itemData.effect ?? null,
    duration: itemData.duration ?? null,
    pet: itemData.pet ?? null,
    light: normalizeObject(itemData.light),
    status_keys: STATUS_KEYS.filter((key) => statusSummary[key] !== undefined),
  });
}

export function normalizeCatalogItem(gameItemKey, itemData, spriteIds = new Set()) {
  let safeItemData = normalizeObject(itemData),
    imageData = resolveMarketplaceImageData(gameItemKey, safeItemData, spriteIds),
    attackStats = sortObject(normalizeObject(safeItemData.attackStats)),
    defenseStats = sortObject(normalizeObject(safeItemData.defenseStats)),
    bonuses = sortObject(normalizeObject(safeItemData.bonuses)),
    statusSummary = buildStatusSummary(safeItemData),
    metadataRaw = sortObject(safeItemData),
    metadataGame = buildMetadataGame(gameItemKey, safeItemData, imageData, statusSummary);

  return {
    itemId: gameItemKey,
    name: safeItemData.name || gameItemKey,
    imageKey: imageData.imageKey,
    imagePath: imageData.imagePath,
    imageSource: imageData.imageSource,
    category: safeItemData.type || 'unknown',
    subcategory: safeItemData.weaponType ?? null,
    requiredSkill: safeItemData.skill ?? null,
    requiredLevel: toIntegerOrNull(safeItemData.level),
    weaponType: safeItemData.weaponType ?? null,
    attackStats,
    defenseStats,
    bonuses,
    statusSummary,
    description: safeItemData.description ?? null,
    stackable: toBoolean(safeItemData.stackable),
    maxStack: Math.max(1, Number(safeItemData.maxStackSize || 1)),
    projectileName: safeItemData.projectileName ?? null,
    metadataRaw,
    metadataGame,
    canSell: false,
    priceBrl: null,
    isImageMapped: imageData.isImageMapped,
  };
}
