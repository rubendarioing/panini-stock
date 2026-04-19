-- Agregar 'accesorio' al CHECK constraint de sale_items
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_tipo_check;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_tipo_check
  CHECK (tipo IN ('album', 'sticker', 'combo', 'accesorio'));
