-- SPEC 13 — Login OAuth con Google y GitHub.
-- Actualiza handle_new_user() (SPEC 04) para que un alta sin
-- raw_user_meta_data->>'username' (caso OAuth) derive un username válido
-- en vez de fallar el insert en profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provided_username text;
  oauth_source      text;
  base_username     text;
  candidate         text;
  suffix            int;
begin
  provided_username := new.raw_user_meta_data ->> 'username';

  if provided_username is null then
    -- GitHub trae el login en user_name; Google trae el nombre en name
    -- (o full_name si name falta).
    oauth_source := coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name'
    );

    base_username := left(
      upper(regexp_replace(coalesce(oauth_source, ''), '[^A-Za-z0-9_]', '', 'g')),
      10
    );
    while length(base_username) < 3 loop
      base_username := base_username || 'X';
    end loop;

    candidate := base_username;
    suffix := 2;
    while exists (select 1 from public.profiles where username = candidate) loop
      candidate := left(base_username, 10 - length(suffix::text)) || suffix::text;
      suffix := suffix + 1;
    end loop;

    provided_username := candidate;
  end if;

  insert into public.profiles (id, username)
  values (new.id, provided_username);
  return new;
end;
$$;
