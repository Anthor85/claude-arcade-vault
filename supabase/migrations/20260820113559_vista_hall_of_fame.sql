-- SPEC 04 — Vista del ranking.
-- El Salón de la Fama no pinta partidas sueltas, sino la mejor marca de cada
-- jugador en cada juego. La tabla scores guarda el historial completo; esta
-- vista lo reduce a lo que la pantalla necesita.
--
-- security_invoker = on: sin ello la vista se ejecutaría con los permisos de
-- quien la creó y se saltaría el RLS de scores y profiles.
create view public.hall_of_fame
with (security_invoker = on) as
select distinct on (s.game_id, s.user_id)
  s.game_id,
  s.user_id,
  p.username,
  s.score,
  s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;
