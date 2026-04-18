-- =============================================
-- PANINI STOCK - Esquema inicial de base de datos
-- =============================================

-- Tipos de colección (Mundiales, Copa América, Otros)
create table collection_types (
  id   serial primary key,
  nombre text not null unique
);

insert into collection_types (nombre) values
  ('Mundiales'),
  ('Copa América'),
  ('Otros Torneos');

-- Colecciones (álbumes específicos por torneo)
create table collections (
  id          serial primary key,
  type_id     int not null references collection_types(id) on delete restrict,
  nombre      text not null,
  anio        int not null,
  descripcion text,
  imagen_url  text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Álbumes (producto físico de una colección)
create table albums (
  id            serial primary key,
  collection_id int not null references collections(id) on delete cascade,
  nombre        text not null,
  edicion       text,
  total_laminas int not null default 0,
  created_at    timestamptz not null default now()
);

-- Láminas individuales
create table stickers (
  id          serial primary key,
  album_id    int not null references albums(id) on delete cascade,
  numero      text not null,
  descripcion text,
  categoria   text,
  created_at  timestamptz not null default now(),
  unique(album_id, numero)
);

-- Perfiles de usuario (extiende auth.users)
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nombre     text not null,
  rol        text not null default 'staff' check (rol in ('admin', 'staff')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Stock de álbumes completos
create table stock_albums (
  id            serial primary key,
  album_id      int not null references albums(id) on delete restrict,
  cantidad      int not null default 0 check (cantidad >= 0),
  precio_compra numeric(12,2) not null,
  precio_venta  numeric(12,2) not null,
  fecha_compra  date not null,
  condicion     text not null default 'nuevo' check (condicion in ('nuevo', 'usado', 'sellado')),
  usuario_id    uuid not null references profiles(id),
  notas         text,
  created_at    timestamptz not null default now()
);

-- Stock de láminas sueltas
create table stock_stickers (
  id            serial primary key,
  sticker_id    int not null references stickers(id) on delete restrict,
  cantidad      int not null default 0 check (cantidad >= 0),
  precio_compra numeric(12,2) not null,
  precio_venta  numeric(12,2) not null,
  fecha_compra  date not null,
  es_repetida   boolean not null default false,
  usuario_id    uuid not null references profiles(id),
  notas         text,
  created_at    timestamptz not null default now()
);

-- Combos
create table combos (
  id          serial primary key,
  nombre      text not null,
  descripcion text,
  precio_total numeric(12,2) not null,
  activo      boolean not null default true,
  creado_por  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- Ítems dentro de un combo
create table combo_items (
  id               serial primary key,
  combo_id         int not null references combos(id) on delete cascade,
  tipo             text not null check (tipo in ('album', 'sticker')),
  stock_album_id   int references stock_albums(id),
  stock_sticker_id int references stock_stickers(id),
  cantidad         int not null default 1 check (cantidad > 0)
);

-- Ventas
create table sales (
  id               serial primary key,
  cliente_nombre   text,
  cliente_contacto text,
  total            numeric(12,2) not null,
  metodo_pago      text not null default 'efectivo' check (metodo_pago in ('efectivo', 'transferencia', 'otro')),
  fecha            timestamptz not null default now(),
  usuario_id       uuid not null references profiles(id),
  notas            text,
  created_at       timestamptz not null default now()
);

-- Ítems de venta
create table sale_items (
  id              serial primary key,
  sale_id         int not null references sales(id) on delete cascade,
  tipo            text not null check (tipo in ('album', 'sticker', 'combo')),
  referencia_id   int not null,
  cantidad        int not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  subtotal        numeric(12,2) not null
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
alter table collection_types enable row level security;
alter table collections      enable row level security;
alter table albums           enable row level security;
alter table stickers         enable row level security;
alter table profiles         enable row level security;
alter table stock_albums     enable row level security;
alter table stock_stickers   enable row level security;
alter table combos           enable row level security;
alter table combo_items      enable row level security;
alter table sales            enable row level security;
alter table sale_items       enable row level security;

-- Lectura: cualquier usuario autenticado
create policy "authenticated read collection_types" on collection_types for select to authenticated using (true);
create policy "authenticated read collections"      on collections      for select to authenticated using (true);
create policy "authenticated read albums"           on albums           for select to authenticated using (true);
create policy "authenticated read stickers"         on stickers         for select to authenticated using (true);
create policy "authenticated read profiles"         on profiles         for select to authenticated using (true);
create policy "authenticated read stock_albums"     on stock_albums     for select to authenticated using (true);
create policy "authenticated read stock_stickers"   on stock_stickers   for select to authenticated using (true);
create policy "authenticated read combos"           on combos           for select to authenticated using (true);
create policy "authenticated read combo_items"      on combo_items      for select to authenticated using (true);
create policy "authenticated read sales"            on sales            for select to authenticated using (true);
create policy "authenticated read sale_items"       on sale_items       for select to authenticated using (true);

-- Escritura: usuarios autenticados en stock/ventas
create policy "authenticated insert stock_albums"   on stock_albums   for insert to authenticated with check (true);
create policy "authenticated update stock_albums"   on stock_albums   for update to authenticated using (true);
create policy "authenticated delete stock_albums"   on stock_albums   for delete to authenticated using (true);

create policy "authenticated insert stock_stickers" on stock_stickers for insert to authenticated with check (true);
create policy "authenticated update stock_stickers" on stock_stickers for update to authenticated using (true);
create policy "authenticated delete stock_stickers" on stock_stickers for delete to authenticated using (true);

create policy "authenticated insert sales"          on sales          for insert to authenticated with check (true);
create policy "authenticated insert sale_items"     on sale_items     for insert to authenticated with check (true);

create policy "authenticated insert combos"         on combos         for insert to authenticated with check (true);
create policy "authenticated update combos"         on combos         for update to authenticated using (true);
create policy "authenticated insert combo_items"    on combo_items    for insert to authenticated with check (true);

-- Solo admin puede gestionar colecciones/álbumes/láminas
create policy "admin insert collections" on collections for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin update collections" on collections for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin delete collections" on collections for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "admin insert albums" on albums for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin update albums" on albums for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin delete albums" on albums for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "admin insert stickers" on stickers for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin update stickers" on stickers for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
create policy "admin delete stickers" on stickers for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, nombre, rol, activo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), 'staff', true)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
