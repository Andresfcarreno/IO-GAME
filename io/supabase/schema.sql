-- IO — sincronización opcional entre dispositivos.
-- Un documento JSON por item: hábitos (habit:*), registro diario (log:YYYY-MM-DD) y el estado del juego (io:game).
-- Corre esto una vez en Supabase → SQL Editor.
create table if not exists public.io_items (
  id          text primary key,
  kind        text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  user_id     uuid references auth.users(id)
);
create index if not exists io_items_kind_idx on public.io_items (kind);
alter table public.io_items enable row level security;

-- ⚠️ Un solo usuario sin login: política abierta para la anon key. No publiques URL + key juntas.
-- Cuando haya login (Google), reemplázala por: using (auth.uid() = user_id) with check (auth.uid() = user_id).
drop policy if exists "anon all items" on public.io_items;
create policy "anon all items" on public.io_items for all using (true) with check (true);

-- ============================================================
-- RANKING (v8). Un proyecto compartido por todos los jugadores.
-- 1) Authentication → Sign In / Providers → activa "Allow anonymous sign-ins".
-- 2) Corre este bloque. 3) Pon la URL y la anon key en io/config.js (RANKING).
-- Cada jugador entra con una cuenta anónima (sin correo) y solo puede escribir SU fila.
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
create policy "ranking: cada quien inserta lo suyo" on public.io_ranking for insert with check (auth.uid() = user_id);
drop policy if exists "ranking: cada quien edita lo suyo" on public.io_ranking;
create policy "ranking: cada quien edita lo suyo" on public.io_ranking for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ranking: cada quien se borra" on public.io_ranking;
create policy "ranking: cada quien se borra" on public.io_ranking for delete using (auth.uid() = user_id);
-- Nota: el XP lo calcula el dispositivo. Para un ranking a prueba de trampas, más adelante
-- mueve el cálculo a una Edge Function que valide cada sesión del temporizador.

-- ============================================================
-- SOCIAL (v11): likes semanales y salas para enfocarse juntos.
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
create policy "likes: das los tuyos" on public.io_likes for insert with check (auth.uid() = from_user);

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
create policy "salas: tu fila" on public.io_rooms for insert with check (auth.uid() = user_id);
drop policy if exists "salas: editas tu fila" on public.io_rooms;
create policy "salas: editas tu fila" on public.io_rooms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "salas: borras tu fila" on public.io_rooms;
create policy "salas: borras tu fila" on public.io_rooms for delete using (auth.uid() = user_id);
-- La foto de tu piso (para que te visiten) viaja dentro de io_ranking.look (máx. 9 objetos).
