-- SPEC 04 — Perfiles y puntuaciones.
-- Crea las dos tablas del dominio, el trigger que da de alta el perfil al
-- registrarse y las políticas RLS. Toda la seguridad del proyecto vive aquí:
-- la aplicación solo usa la clave publishable.

-- ---------------------------------------------------------------------------
-- profiles: un perfil por usuario de auth.users.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint username_formato check (username ~ '^[A-Z0-9_]{3,10}$')
);

-- El perfil lo crea el trigger, no la aplicación: así el nick queda registrado
-- en la misma transacción que el usuario y su unicidad es real.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- scores: una fila por partida guardada.
-- game_id es el id del catálogo de lib/games.ts; no se duplica en la base de datos.
-- ---------------------------------------------------------------------------
create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_ranking_idx on public.scores (game_id, score desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.scores enable row level security;

-- El Salón de la Fama necesita mostrar los nicks de todo el mundo.
create policy "perfiles visibles para todos"
  on public.profiles for select
  using (true);

create policy "cada quien edita su perfil"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sin políticas de insert/delete en profiles: solo el trigger, que es security definer.

create policy "puntuaciones visibles para todos"
  on public.scores for select
  using (true);

create policy "cada quien inscribe sus puntuaciones"
  on public.scores for insert
  with check ((select auth.uid()) = user_id);

-- Sin políticas de update/delete en scores: una marca no se edita ni se borra.
