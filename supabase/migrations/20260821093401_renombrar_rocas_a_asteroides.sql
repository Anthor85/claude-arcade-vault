-- El juego `rocas` del catálogo pasa a llamarse `asteroides` (SPEC 05).
-- `game_id` es texto libre validado solo por el catálogo de `lib/games.ts`:
-- no hay clave foránea que actualizar ni vista que recrear.
update public.scores set game_id = 'asteroides' where game_id = 'rocas';
