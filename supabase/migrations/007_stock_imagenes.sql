CREATE TABLE IF NOT EXISTS stock_imagenes (
  id          serial PRIMARY KEY,
  tabla       text    NOT NULL CHECK (tabla IN ('stock_stickers', 'stock_accesorios')),
  referencia_id integer NOT NULL,
  url         text    NOT NULL,
  orden       integer NOT NULL DEFAULT 0,
  creado_at   timestamptz DEFAULT now()
);

ALTER TABLE stock_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON stock_imagenes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon read" ON stock_imagenes
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_stock_imagenes_ref ON stock_imagenes (tabla, referencia_id, orden);
