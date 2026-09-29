-- IO — base de datos para el lanzamiento.
-- Corre este archivo completo una vez en Supabase → SQL Editor (se puede volver a correr sin problema).
-- Antes: Authentication → Providers → activa Google y Email (ver DEPLOY.md).

-- Solo cuentas reales (Google o correo). Las sesiones anónimas no pueden escribir.
create or replace function public.io_real_user() returns boolean language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- ============================================================
-- PARTIDAS: tu partida en la nube, una fila por dato (hábitos, registro diario, estado del juego).
create table if not exists public.io_saves (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id          text not null check (char_length(id) <= 80),
  kind        text not null check (char_length(kind) <= 20),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  primary key (user_id, id)
);
alter table public.io_saves enable row level security;
drop policy if exists "saves: solo el dueño" on public.io_saves;
create policy "saves: solo el dueño" on public.io_saves for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.io_real_user());

-- ============================================================
-- RANKING: una fila por jugador. Todos leen; cada quien solo escribe la suya.
create table if not exists public.io_ranking (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  level       int  not null default 1 check (level between 1 and 100000),
  xp          bigint not null default 0 check (xp >= 0),
  week_key    date,
  week_xp     int not null default 0 check (week_xp >= 0),
  streak      int not null default 0 check (streak >= 0),
  look        jsonb not null default '{}'::jsonb check (pg_column_size(look) < 2048),
  updated_at  timestamptz not null default now()
);
create index if not exists io_ranking_xp_idx on public.io_ranking (xp desc);
create index if not exists io_ranking_week_idx on public.io_ranking (week_key, week_xp desc);
alter table public.io_ranking enable row level security;
drop policy if exists "ranking: todos leen" on public.io_ranking;
create policy "ranking: todos leen" on public.io_ranking for select using (true);
drop policy if exists "ranking: cada quien inserta lo suyo" on public.io_ranking;
create policy "ranking: cada quien inserta lo suyo" on public.io_ranking for insert with check (auth.uid() = user_id and public.io_real_user());
drop policy if exists "ranking: cada quien edita lo suyo" on public.io_ranking;
create policy "ranking: cada quien edita lo suyo" on public.io_ranking for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.io_real_user());
drop policy if exists "ranking: cada quien se borra" on public.io_ranking;
create policy "ranking: cada quien se borra" on public.io_ranking for delete using (auth.uid() = user_id);
-- Nota: el XP lo calcula el celular. Para un ranking a prueba de trampas, más adelante
-- se valida cada sesión del reloj en el servidor (Edge Function).

-- ============================================================
-- LIKES semanales.
create table if not exists public.io_likes (
  from_user  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  week_key   date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, week_key),
  check (from_user <> to_user)
);
alter table public.io_likes enable row level security;
drop policy if exists "likes: todos leen" on public.io_likes;
create policy "likes: todos leen" on public.io_likes for select using (true);
drop policy if exists "likes: das los tuyos" on public.io_likes;
create policy "likes: das los tuyos" on public.io_likes for insert with check (auth.uid() = from_user and public.io_real_user());

-- ============================================================
-- SALAS para enfocarse juntos.
create table if not exists public.io_rooms (
  room       text not null check (char_length(room) between 4 and 8),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  look       jsonb not null default '{}'::jsonb check (pg_column_size(look) < 1024),
  act        text, habit text check (char_length(habit) <= 40),
  until      timestamptz, paused boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room, user_id)
);
create index if not exists io_rooms_room_idx on public.io_rooms (room, updated_at desc);
alter table public.io_rooms enable row level security;
drop policy if exists "salas: todos leen" on public.io_rooms;
create policy "salas: todos leen" on public.io_rooms for select using (true);
drop policy if exists "salas: tu fila" on public.io_rooms;
create policy "salas: tu fila" on public.io_rooms for insert with check (auth.uid() = user_id and public.io_real_user());
drop policy if exists "salas: editas tu fila" on public.io_rooms;
create policy "salas: editas tu fila" on public.io_rooms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "salas: borras tu fila" on public.io_rooms;
create policy "salas: borras tu fila" on public.io_rooms for delete using (auth.uid() = user_id);

-- ============================================================
-- Versión anterior (sin cuentas): si creaste io_items con la política abierta, ciérrala.
do $$ begin
  if to_regclass('public.io_items') is not null then
    execute 'drop policy if exists "anon all items" on public.io_items';
  end if;
end $$;
