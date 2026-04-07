import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url),
  backendDirectoryPath = path.dirname(currentFilePath),
  workspaceDirectoryPath = path.resolve(backendDirectoryPath, '..', '..'),
  gameItemsFilePath = path.resolve(
    workspaceDirectoryPath,
    'packages',
    'server',
    'data',
    'items.json',
  ),
  spritesFilePath = path.resolve(
    workspaceDirectoryPath,
    'packages',
    'client',
    'data',
    'sprites.json',
  ),
  GAME_ITEMS_SOURCE = 'packages/server/data/items.json',
  SPRITES_SOURCE = 'packages/client/data/sprites.json';

async function readJsonFile(filePath) {
  let rawFile = await fs.readFile(filePath, 'utf8');
  return JSON.parse(rawFile);
}

export function getGameItemsFilePath() {
  return gameItemsFilePath;
}

export function getSpritesFilePath() {
  return spritesFilePath;
}

export function getGameItemsSourceLabel() {
  return GAME_ITEMS_SOURCE;
}

export function getSpritesSourceLabel() {
  return SPRITES_SOURCE;
}

export async function loadGameItemsMap() {
  return readJsonFile(gameItemsFilePath);
}

export async function loadGameItems() {
  let items = await loadGameItemsMap();

  return Object.entries(items).map(([gameItemKey, itemData]) => ({
    gameItemKey,
    itemData,
  }));
}

export async function loadSpriteEntries() {
  return readJsonFile(spritesFilePath);
}

export async function loadSpriteIds() {
  let sprites = await loadSpriteEntries();

  return new Set(
    sprites
      .map((entry) => entry?.id)
      .filter((spriteId) => typeof spriteId === 'string' && spriteId.trim().length > 0),
  );
}

export function resolveMarketplaceImageKey(gameItemKey, itemData = {}) {
  return itemData.spriteName || gameItemKey;
}

export function resolveMarketplaceImageData(gameItemKey, itemData = {}, spriteIds = new Set()) {
  let imageKey = resolveMarketplaceImageKey(gameItemKey, itemData),
    imagePath = `items/${imageKey}`,
    isImageMapped = spriteIds.has(imagePath);

  return {
    imageKey,
    imagePath,
    imageSource: SPRITES_SOURCE,
    isImageMapped,
  };
}
