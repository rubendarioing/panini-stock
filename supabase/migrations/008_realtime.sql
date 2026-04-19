-- Habilitar REPLICA IDENTITY FULL para que Supabase Realtime
-- envíe los valores anteriores y nuevos en cada cambio
ALTER TABLE stock_albums     REPLICA IDENTITY FULL;
ALTER TABLE stock_stickers   REPLICA IDENTITY FULL;
ALTER TABLE stock_accesorios REPLICA IDENTITY FULL;
ALTER TABLE combos           REPLICA IDENTITY FULL;

-- Agregar las tablas a la publicación de Supabase Realtime
-- (solo si no están ya incluidas con FOR ALL TABLES)
ALTER PUBLICATION supabase_realtime ADD TABLE stock_albums;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_stickers;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_accesorios;
ALTER PUBLICATION supabase_realtime ADD TABLE combos;
