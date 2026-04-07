/* global console, process */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, query } from './db.js';
import { registerImportRun } from './catalog.repository.js';
import { generateSeedSqlFile } from './generate-seed-sql.js';
import { getGameItemsSourceLabel, getSpritesSourceLabel } from './game-items-source.js';

const currentFilePath = fileURLToPath(import.meta.url),
  backendDirectoryPath = path.dirname(currentFilePath),
  postgresDirectoryPath = path.resolve(backendDirectoryPath, '..', 'postgres'),
  schemaFilePath = path.resolve(postgresDirectoryPath, '001_schema.sql'),
  seedFilePath = path.resolve(postgresDirectoryPath, '002_seed_game_items.sql'),
  indexesAndViewsFilePath = path.resolve(postgresDirectoryPath, '003_indexes_and_views.sql');

async function applySqlFile(filePath) {
  let sql = await fs.readFile(filePath, 'utf8');
  await query(sql);
}

async function run() {
  await applySqlFile(schemaFilePath);

  let seedSummary = await generateSeedSqlFile();

  await applySqlFile(seedFilePath);
  await applySqlFile(indexesAndViewsFilePath);

  await registerImportRun({
    sourceOrigin: getGameItemsSourceLabel(),
    importType: 'seed_sql',
    itemsRead: seedSummary.itemCount,
    seedFilePath: 'Marketplace/postgres/002_seed_game_items.sql',
    notes: `Bootstrap automático aplicado na ordem 001 -> 002 -> 003 com origem em ${getGameItemsSourceLabel()} e validação visual em ${getSpritesSourceLabel()}.`,
  });

  console.log(
    JSON.stringify(
      {
        source: getGameItemsSourceLabel(),
        sprites: getSpritesSourceLabel(),
        importedItems: seedSummary.itemCount,
        generatedSeed: 'Marketplace/postgres/002_seed_game_items.sql',
        bootstrapOrder: [
          'Marketplace/postgres/001_schema.sql',
          'Marketplace/postgres/002_seed_game_items.sql',
          'Marketplace/postgres/003_indexes_and_views.sql',
        ],
        defaultCanSell: false,
        defaultPriceBrl: null,
        mappedImages: seedSummary.mappedImages,
        missingImages: seedSummary.missingImages,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error('Falha ao importar catálogo real do jogo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
