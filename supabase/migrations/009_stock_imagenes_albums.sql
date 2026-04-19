-- Add imagen_url to stock_albums for per-entry images (was removed in 006)
ALTER TABLE stock_albums ADD COLUMN IF NOT EXISTS imagen_url text;

-- Extend stock_imagenes CHECK constraint to include stock_albums
ALTER TABLE stock_imagenes DROP CONSTRAINT IF EXISTS stock_imagenes_tabla_check;
ALTER TABLE stock_imagenes ADD CONSTRAINT stock_imagenes_tabla_check
  CHECK (tabla IN ('stock_stickers', 'stock_accesorios', 'stock_albums'));
