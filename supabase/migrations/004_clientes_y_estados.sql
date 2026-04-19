-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  email     text,
  telefono  text,
  ciudad    text,
  direccion text,
  created_at timestamptz default now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read clientes"  ON clientes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "public insert clientes" ON clientes FOR INSERT WITH CHECK (true);

-- Nuevas columnas en sales
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS cliente_id      bigint REFERENCES clientes(id),
  ADD COLUMN IF NOT EXISTS estado          text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','confirmado','enviado','entregado','cancelado')),
  ADD COLUMN IF NOT EXISTS comprobante_url text,
  ADD COLUMN IF NOT EXISTS direccion_envio text,
  ADD COLUMN IF NOT EXISTS ciudad          text,
  ADD COLUMN IF NOT EXISTS email_cliente   text;

-- Bucket para comprobantes de pago
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public upload comprobantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes');

CREATE POLICY "public read comprobantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes');
