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
