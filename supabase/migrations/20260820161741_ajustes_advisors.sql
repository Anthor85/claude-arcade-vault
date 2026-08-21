-- SPEC 04, paso 13 — lo que reportaron los advisors.

-- 1. `handle_new_user` solo la ejecuta el trigger. Sin este revoke aparece
--    publicada en /rest/v1/rpc como función security definer.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 2. La clave ajena scores.user_id no tenía índice que la cubriera: el índice
--    del ranking empieza por game_id y no sirve. Sin él, borrar un perfil
--    obliga a recorrer scores entera.
create index scores_user_id_idx on public.scores (user_id);
