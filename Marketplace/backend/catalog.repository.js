import { query } from './db.js';

function parseNumeric(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function mapCatalogRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    name: row.name,
    imageKey: row.image_key,
    imagePath: row.image_path,
    imageSource: row.image_source,
    category: row.category,
    subcategory: row.subcategory,
    requiredSkill: row.required_skill,
    requiredLevel: row.required_level,
    weaponType: row.weapon_type,
    attackStats: row.attack_stats || {},
    defenseStats: row.defense_stats || {},
    bonuses: row.bonuses || {},
    statusSummary: row.status_summary || {},
    description: row.description,
    stackable: row.stackable,
    maxStack: row.max_stack,
    projectileName: row.projectile_name,
    metadataRaw: row.metadata_raw || {},
    metadataGame: row.metadata_game || {},
    canSell: row.can_sell,
    priceBrl: parseNumeric(row.price_brl),
    isImageMapped: row.is_image_mapped,
    lastImportedAt: row.last_imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLimit(limit, fallback = 200, max = 1000) {
  return Math.max(1, Math.min(Number(limit || fallback), max));
}

function buildCatalogFilters(options = {}, params = []) {
  let conditions = [],
    searchTerm = String(options.searchTerm || '')
      .trim()
      .toLowerCase();

  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    conditions.push(`(
      lower(item_id) LIKE $${params.length}
      OR lower(name) LIKE $${params.length}
      OR lower(category) LIKE $${params.length}
    )`);
  }

  if (options.category) {
    params.push(String(options.category).trim().toLowerCase());
    conditions.push(`lower(category) = $${params.length}`);
  }

  if (options.requiredSkill) {
    params.push(String(options.requiredSkill).trim().toLowerCase());
    conditions.push(`lower(required_skill) = $${params.length}`);
  }

  if (options.hasImage === true || options.hasImage === false) {
    params.push(options.hasImage);
    conditions.push(`is_image_mapped = $${params.length}`);
  }

  if (options.canSellOnly) conditions.push('can_sell = TRUE AND price_brl IS NOT NULL');

  return {
    params,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

export async function listCatalogItems(options = {}) {
  let params = [],
    { whereClause } = buildCatalogFilters(options, params),
    limit = normalizeLimit(options.limit);

  params.push(limit);

  let result = await query(
    `
      SELECT
        id,
        item_id,
        name,
        image_key,
        image_path,
        image_source,
        category,
        subcategory,
        required_skill,
        required_level,
        weapon_type,
        attack_stats,
        defense_stats,
        bonuses,
        status_summary,
        description,
        stackable,
        max_stack,
        projectile_name,
        metadata_raw,
        metadata_game,
        can_sell,
        price_brl,
        is_image_mapped,
        last_imported_at,
        created_at,
        updated_at
      FROM catalog_items
      ${whereClause}
      ORDER BY can_sell DESC, category ASC, name ASC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map((row) => mapCatalogRow(row));
}

export async function listSellableCatalogItems(options = {}) {
  let params = [],
    clonedOptions = {
      ...options,
      canSellOnly: true,
    },
    { whereClause } = buildCatalogFilters(clonedOptions, params),
    limit = normalizeLimit(options.limit, 60, 200);

  params.push(limit);

  let result = await query(
    `
      SELECT
        id,
        item_id,
        name,
        image_key,
        image_path,
        image_source,
        category,
        subcategory,
        required_skill,
        required_level,
        weapon_type,
        attack_stats,
        defense_stats,
        bonuses,
        status_summary,
        description,
        stackable,
        max_stack,
        projectile_name,
        metadata_raw,
        metadata_game,
        can_sell,
        price_brl,
        is_image_mapped,
        last_imported_at,
        created_at,
        updated_at
      FROM vw_catalog_sellable_items
      ${whereClause}
      ORDER BY price_brl ASC NULLS LAST, name ASC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map((row) => mapCatalogRow(row));
}

export async function getCatalogStats() {
  let result = await query(`
    SELECT
      COUNT(*)::int AS total_items,
      COUNT(*) FILTER (WHERE can_sell = TRUE)::int AS sellable_items,
      COUNT(*) FILTER (WHERE can_sell = FALSE)::int AS hidden_items,
      COUNT(*) FILTER (WHERE is_image_mapped = TRUE)::int AS mapped_images,
      COUNT(*) FILTER (WHERE is_image_mapped = FALSE)::int AS missing_images,
      COUNT(DISTINCT category)::int AS distinct_categories,
      MAX(last_imported_at) AS last_imported_at
    FROM catalog_items
  `),
    row = result.rows[0] || {};

  return {
    totalItems: row.total_items || 0,
    sellableItems: row.sellable_items || 0,
    hiddenItems: row.hidden_items || 0,
    mappedImages: row.mapped_images || 0,
    missingImages: row.missing_images || 0,
    distinctCategories: row.distinct_categories || 0,
    lastImportedAt: row.last_imported_at || null,
  };
}

export async function registerImportRun(summary) {
  await query(
    `
      INSERT INTO catalog_import_runs (
        source_origin,
        import_type,
        items_read,
        seed_file_path,
        notes
      ) VALUES ($1, $2, $3, $4, $5)
    `,
    [
      summary.sourceOrigin,
      summary.importType,
      summary.itemsRead,
      summary.seedFilePath,
      summary.notes,
    ],
  );
}
