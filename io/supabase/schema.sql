-- ============================================================
-- IO — esquema Supabase (v5)
-- Seguro de correr varias veces (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Corre esto en Supabase → SQL Editor.
-- ============================================================

-- 1) Transacciones (misma forma que ya usan el dashboard v4, Make y Telegram)
create table if not exists public.transactions (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  fecha            date not null,                 -- YYYY-MM-DD
  hora             text,                          -- HH:MM
  descripcion      text not null,
  monto            numeric(12,2) not null,
  tipo             text not null check (tipo in ('gasto','ingreso')),
  categoria        text not null default 'otros',
  mensaje_original text,
  origen           text not null default 'telegram',  -- telegram | app | banco | correo | fijo
  user_id          uuid references auth.users(id)
);
create index if not exists transactions_fecha_idx on public.transactions (fecha desc);

-- 2) Todo lo demás de tu vida: salud, diario, personas, interacciones, metas, fijos.
--    Un documento JSON por item; la app hace upsert por id y resuelve conflictos por updated_at.
create table if not exists public.io_items (
  id          text primary key,              -- p.ej. 'health:2026-09-27', 'goal:lx3k9a'
  kind        text not null,                 -- health | journal | person | interaction | goal | fijo
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  user_id     uuid references auth.users(id)
);
create index if not exists io_items_kind_idx on public.io_items (kind);

alter table public.transactions enable row level security;
alter table public.io_items     enable row level security;

-- ⚠️ ESTADO ACTUAL: un solo usuario, sin login → políticas abiertas para la anon key.
-- Es aceptable SOLO mientras la URL/key del proyecto no se publiquen. La app ya no
-- trae la key en el código: se configura en ⚙️ Ajustes y vive en tu dispositivo.
-- Antes de invitar a Diana/Juan, migra a las políticas por usuario de abajo.
drop policy if exists "anon read all"   on public.transactions;
drop policy if exists "anon insert all" on public.transactions;
drop policy if exists "anon delete all" on public.transactions;
create policy "anon read all"   on public.transactions for select using (true);
create policy "anon insert all" on public.transactions for insert with check (true);
create policy "anon delete all" on public.transactions for delete using (true);

drop policy if exists "anon all items" on public.io_items;
create policy "anon all items" on public.io_items for all using (true) with check (true);

-- 3) Vinculación Telegram (para multiusuario más adelante)
create table if not exists public.telegram_links (
  chat_id    bigint primary key,
  user_id    uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;  -- sin políticas: solo el service role

-- ============================================================
-- MIGRACIÓN A MULTIUSUARIO (cuando exista Google Auth):
--   drop policy "anon read all" on public.transactions;  (y las demás "anon …")
--   create policy "own tx"    on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
--   create policy "own items" on public.io_items     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Las Edge Functions usan el service role y resuelven user_id vía telegram_links.
-- ============================================================

-- 4) (Opcional) Programar los fijos automáticos todos los días a las 8:05 (hora de Montreal ≈ 12:05 UTC).
--    Requiere las extensiones pg_cron y pg_net (Database → Extensions).
-- select cron.schedule('io-fijos', '5 12 * * *', $$
--   select net.http_post(
--     url := 'https://TU-PROYECTO.supabase.co/functions/v1/fijos',
--     headers := jsonb_build_object('x-io-secret', 'TU_INGEST_SECRET')
--   );
-- $$);
