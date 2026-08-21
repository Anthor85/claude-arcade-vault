-- SPEC 04, paso 13 — el revoke anterior no bastaba.
-- Postgres concede EXECUTE a PUBLIC en toda función nueva, y ese grant sigue
-- vivo aunque se revoque el de anon y authenticated. La función solo la llama
-- el trigger `on_auth_user_created`, que corre como el dueño.
revoke execute on function public.handle_new_user() from public;
