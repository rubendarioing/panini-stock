-- Migración: eliminar tabla collections, mover type_id y anio directamente a albums

-- 1. Agregar nuevas columnas a albums
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS type_id int REFERENCES collection_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS anio    int NOT NULL DEFAULT 2024,
  ADD COLUMN IF NOT EXISTS activo  boolean NOT NULL DEFAULT true;

-- 2. Eliminar FK de albums hacia collections
ALTER TABLE albums DROP CONSTRAINT IF EXISTS albums_collection_id_fkey;

-- 3. Eliminar columna collection_id de albums
ALTER TABLE albums DROP COLUMN IF EXISTS collection_id;

-- 4. Eliminar tabla collections (no hay datos)
DROP TABLE IF EXISTS collections CASCADE;

-- 5. RLS para albums (escritura admin, lectura todos)
DROP POLICY IF EXISTS "admin insert albums" ON albums;
DROP POLICY IF EXISTS "admin update albums" ON albums;
DROP POLICY IF EXISTS "admin delete albums" ON albums;

CREATE POLICY "admin insert albums" ON albums FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin update albums" ON albums FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin delete albums" ON albums FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));
