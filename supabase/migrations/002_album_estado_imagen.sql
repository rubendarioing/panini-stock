-- Agregar estado (lleno/vacío) al stock de álbumes
ALTER TABLE stock_albums
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'vacio'
  CHECK (estado IN ('lleno', 'vacio'));

-- Agregar imagen a la tabla de álbumes
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS imagen_url text;

-- Bucket de imágenes (ejecutar desde SQL Editor de Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('album-images', 'album-images', true)
ON CONFLICT (id) DO NOTHING;

-- Política: cualquier usuario autenticado puede subir imágenes
CREATE POLICY "authenticated upload album-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'album-images');

-- Política: lectura pública de imágenes
CREATE POLICY "public read album-images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'album-images');

-- Política: borrar imágenes propias
CREATE POLICY "authenticated delete album-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'album-images');
