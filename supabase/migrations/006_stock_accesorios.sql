-- Revertir cambios de migration 005 en stock_albums
ALTER TABLE stock_albums DROP COLUMN IF EXISTS tipo;
ALTER TABLE stock_albums DROP COLUMN IF EXISTS cantidad_contenido;
ALTER TABLE stock_albums DROP COLUMN IF EXISTS imagen_url;

-- Crear tabla stock_accesorios (sobres y cajas selladas)
CREATE TABLE IF NOT EXISTS stock_accesorios (
  id                 serial primary key,
  album_id           int references albums(id) not null,
  tipo               text check (tipo in ('sobre', 'caja')) not null,
  cantidad_contenido int,
  precio_compra      numeric not null default 0,
  precio_venta       numeric not null default 0,
  cantidad           int not null default 0,
  imagen_url         text,
  condicion          text not null default 'nuevo',
  notas              text,
  fecha_compra       date not null default current_date,
  usuario_id         uuid references profiles(id)
);

ALTER TABLE stock_accesorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read stock_accesorios"        ON stock_accesorios FOR SELECT USING (true);
CREATE POLICY "authenticated write stock_accesorios" ON stock_accesorios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Agregar referencia a accesorios en combo_items
ALTER TABLE combo_items ADD COLUMN IF NOT EXISTS stock_accesorio_id int references stock_accesorios(id);
