CREATE TABLE IF NOT EXISTS catalog_items (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_key TEXT,
  image_path TEXT,
  image_source TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  required_skill TEXT,
  required_level INTEGER,
  weapon_type TEXT,
  attack_stats JSONB NOT NULL DEFAULT '{}'::JSONB,
  defense_stats JSONB NOT NULL DEFAULT '{}'::JSONB,
  bonuses JSONB NOT NULL DEFAULT '{}'::JSONB,
  status_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  description TEXT,
  stackable BOOLEAN NOT NULL DEFAULT FALSE,
  max_stack INTEGER NOT NULL DEFAULT 1,
  projectile_name TEXT,
  metadata_raw JSONB NOT NULL,
  metadata_game JSONB NOT NULL DEFAULT '{}'::JSONB,
  can_sell BOOLEAN NOT NULL DEFAULT FALSE,
  price_brl NUMERIC(10, 2),
  is_image_mapped BOOLEAN NOT NULL DEFAULT FALSE,
  last_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_items_price_brl_non_negative CHECK (price_brl IS NULL OR price_brl >= 0),
  CONSTRAINT catalog_items_max_stack_minimum CHECK (max_stack >= 1),
  CONSTRAINT catalog_items_sellable_requires_price CHECK (NOT can_sell OR price_brl IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS catalog_import_runs (
  id BIGSERIAL PRIMARY KEY,
  source_origin TEXT NOT NULL,
  import_type TEXT NOT NULL DEFAULT 'seed_sql',
  items_read INTEGER NOT NULL DEFAULT 0,
  seed_file_path TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_catalog_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_items_set_updated_at ON catalog_items;

CREATE TRIGGER trg_catalog_items_set_updated_at
BEFORE UPDATE ON catalog_items
FOR EACH ROW
EXECUTE FUNCTION set_catalog_items_updated_at();
