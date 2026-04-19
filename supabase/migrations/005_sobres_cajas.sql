-- Agregar tipo y cantidad_contenido a stock_albums
ALTER TABLE stock_albums ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'album';
ALTER TABLE stock_albums ADD COLUMN IF NOT EXISTS cantidad_contenido integer;

-- Actualizar CHECK constraint de estado para permitir null en sobres/cajas
-- (el estado solo aplica cuando tipo = 'album')
