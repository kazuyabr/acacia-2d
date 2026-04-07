CREATE INDEX IF NOT EXISTS idx_catalog_items_can_sell ON catalog_items (can_sell);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items (category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_required_skill ON catalog_items (required_skill);
CREATE INDEX IF NOT EXISTS idx_catalog_items_is_image_mapped ON catalog_items (is_image_mapped);
CREATE INDEX IF NOT EXISTS idx_catalog_items_price_brl ON catalog_items (price_brl);
CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items (name);
CREATE INDEX IF NOT EXISTS idx_catalog_items_last_imported_at ON catalog_items (last_imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status_summary_gin
  ON catalog_items
  USING GIN (status_summary);

CREATE OR REPLACE VIEW vw_catalog_sellable_items AS
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
WHERE can_sell = TRUE
  AND price_brl IS NOT NULL
  AND is_image_mapped = TRUE;

CREATE OR REPLACE VIEW vw_catalog_image_gaps AS
SELECT
  item_id,
  name,
  category,
  image_key,
  image_path,
  image_source,
  is_image_mapped,
  metadata_game,
  last_imported_at
FROM catalog_items
WHERE is_image_mapped = FALSE;
