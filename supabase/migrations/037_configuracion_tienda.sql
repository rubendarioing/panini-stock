-- Datos de contacto de la tienda (WhatsApp, correo, redes), editables desde el
-- panel (Administración → Configuración) sin volver a desplegar.
--
-- Una sola fila (id = 1). Lectura pública (la tienda es anónima); escritura
-- solo admin, mismo patrón que productos/categorias en 019.

create table if not exists public.configuracion_tienda (
  id smallint primary key default 1,
  whatsapp text,                 -- formato internacional sin "+", ej. 573001234567
  mensaje_whatsapp text,         -- mensaje inicial al abrir el chat
  email_contacto text,
  instagram_url text,
  facebook_url text,
  updated_at timestamptz not null default now(),

  constraint configuracion_tienda_una_fila_ck check (id = 1),
  constraint configuracion_tienda_whatsapp_ck check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$')
);

insert into public.configuracion_tienda (id, mensaje_whatsapp)
values (1, 'Hola, quiero información sobre los álbumes y láminas de la tienda.')
on conflict (id) do nothing;

alter table public.configuracion_tienda enable row level security;

drop policy if exists "public read configuracion_tienda" on public.configuracion_tienda;
create policy "public read configuracion_tienda" on public.configuracion_tienda
  for select using (true);

drop policy if exists "admin update configuracion_tienda" on public.configuracion_tienda;
create policy "admin update configuracion_tienda" on public.configuracion_tienda
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

grant select on public.configuracion_tienda to anon, authenticated;
grant update on public.configuracion_tienda to authenticated;
