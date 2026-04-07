/* global console, process */

import { closePool } from './db.js';
import { getCatalogStats, listCatalogItems, listSellableCatalogItems } from './catalog.repository.js';
import { ensureSchema } from './schema.js';

function parseArguments(argv) {
  const args = new Set(argv);

  return {
    canSellOnly: args.has('--sellable') || args.has('--selling') || args.has('--venda'),
    limit: Number(
      argv.find((value, index) => argv[index - 1] === '--limit') ||
        process.env.MARKETPLACE_CATALOG_LIST_LIMIT ||
        20,
    ),
  };
}

async function run() {
  const options = parseArguments(process.argv.slice(2));

  await ensureSchema();

  const [stats, items] = await Promise.all([
    getCatalogStats(),
    options.canSellOnly
      ? listSellableCatalogItems({ limit: options.limit })
      : listCatalogItems({ limit: options.limit }),
  ]);

  console.log(
    JSON.stringify(
      {
        stats,
        items: items.map((item) => ({
          id: item.id,
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          canSell: item.canSell,
          priceBrl: item.priceBrl,
          requiredSkill: item.requiredSkill,
          requiredLevel: item.requiredLevel,
          imageKey: item.imageKey,
          imagePath: item.imagePath,
          isImageMapped: item.isImageMapped,
        })),
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error('Falha ao listar catálogo do marketplace:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
