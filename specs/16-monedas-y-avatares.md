# SPEC 16 — Monedas y avatares desbloqueables

> **Estado:** Borrador
> **Depende de:** SPEC 04, SPEC 14
> **Fecha:** 2026-08-26
> **Objetivo:** Cada partida guardada da monedas proporcionales a la puntuación; con esas monedas el jugador desbloquea avatares de un set cerrado, y el elegido sustituye al icono/foto que hoy muestra el nav (SPEC 14).

## Por qué existe esta spec

Hoy el único progreso persistente del jugador es la fila que deja en `scores` y su posición en el Salón de la Fama. No hay ninguna razón para volver aparte de mejorar la puntuación. Esta spec añade una capa de meta-juego mínima: monedas ganadas jugando y un elemento cosmético (avatar) que gastarlas. Es el primer sub-proyecto de una idea más amplia; quedan fuera y con spec propia cuando lleguen: logros como fuente de monedas, y skins de pago por juego (hoy las skins de `skin-designer` son gratis y no se tocan aquí).

## Riesgo heredado y cómo se acota

`saveScore` (`app/juegos/[id]/jugar/actions.ts`) documenta que la puntuación llega del cliente sin validar: es un riesgo asumido porque, como mucho, falsea el Salón de la Fama. Si las monedas salen de esa misma puntuación, el mismo hueco pasa de vanidad a economía gratis. Esta spec no cierra el hueco de origen (sigue fuera de alcance validar la puntuación en servidor), pero limita el daño:

- Las monedas por partida se calculan en el Server Action, no las manda el cliente.
- Tope fijo por partida (`MAX_MONEDAS_PARTIDA = 100`), reforzado también como `check` en la base de datos.
- Todo movimiento de monedas queda en un ledger insert-only (nunca se sobreescribe un saldo), así que un abuso puntual es auditable y revisable a mano sin tocar código.

## Alcance

**Dentro:**

- Migración nueva: tabla `coin_transactions` (ledger), vista `coin_balance`, tabla `avatar_unlocks`, tabla `avatar_precios`, columna `avatar_id` en `profiles`, función `canjear_avatar` (RPC, `security definer`).
- `lib/avatars.ts`: catálogo estático de avatares desbloqueables (id, nombre, precio, ruta de imagen), siguiendo el patrón de `lib/games.ts`. El precio vive también en `avatar_precios` (migración) como fuente de verdad para el RPC; los dos deben coincidir a mano, no hay generación automática.
- `app/juegos/[id]/jugar/actions.ts`: `saveScore` inserta también una fila en `coin_transactions` (`reason: 'partida'`, `delta = min(100, floor(score / 10))`).
- Nueva ruta `/perfil`: saldo de monedas, avatar actual y grid de avatares (bloqueado/desbloqueado/equipado) con botón de canjear o equipar.
- Nuevo Server Action `app/perfil/actions.ts`: `canjearAvatar(avatarId)` (llama al RPC) y `equiparAvatar(avatarId)` (`update profiles set avatar_id`, solo si está desbloqueado).
- `lib/supabase/session.ts`: `getSessionUser()` añade `avatarId` a `SessionUser` y, si hay `avatar_id` con avatar válido en el catálogo, su imagen tiene prioridad sobre `avatar_url` de OAuth para el bloque avatar+nombre del nav (SPEC 14).
- Enlace a `/perfil` desde el bloque avatar+nombre del nav (deja de ser puramente decorativo; ver Decisiones).

**Fuera (otra spec si llega):**

- Validar la puntuación en servidor antes de dar monedas: sigue siendo un riesgo asumido, igual que en SPEC 04.
- Logros como fuente de monedas: `coin_transactions.reason` ya admite valores futuros (`'logro'`, etc.) pero no se implementa ningún logro aquí.
- Skins de pago por juego: el sistema de skins de `skin-designer` sigue gratis y sin tocar.
- Subir avatar propio: el catálogo es un set cerrado de imágenes fijas del proyecto, sin storage ni moderación.
- Gastar monedas en nada que no sea avatares (temas de UI, marcos, etc.).
- Cualquier compra con dinero real.

## Modelo de datos

```sql
-- Ledger insert-only: nunca se actualiza ni se borra una fila.
create table public.coin_transactions (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  delta      integer not null check (delta <> 0),
  reason     text not null check (reason in ('partida', 'canje_avatar')),
  game_id    text,                    -- solo relevante cuando reason = 'partida'
  created_at timestamptz not null default now(),
  constraint tope_partida check (reason <> 'partida' or delta between 1 and 100)
);

create view public.coin_balance as
  select profile_id, coalesce(sum(delta), 0)::integer as balance
  from public.coin_transactions
  group by profile_id;

create table public.avatar_unlocks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  avatar_id  text not null,
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, avatar_id)
);

-- Fuente de verdad del precio: la función NUNCA confía en un precio mandado
-- por el cliente. Debe reflejar a mano lo que dice lib/avatars.ts.
create table public.avatar_precios (
  avatar_id text primary key,
  precio    integer not null check (precio > 0)
);

alter table public.profiles add column avatar_id text; -- null = comportamiento actual (SPEC 14)
```

- `canjear_avatar(p_avatar_id text)` — función `security definer`, sin parámetro de precio: valida `auth.uid()`, busca `p_avatar_id` en `avatar_precios` (falla si no existe), que `p_avatar_id` no esté ya en `avatar_unlocks` para ese perfil, y que el saldo (`coin_balance`) sea `>= precio`; si todo cuadra, inserta el movimiento negativo en `coin_transactions` (por el precio leído de la tabla, nunca del argumento) y la fila en `avatar_unlocks`, en la misma transacción.
- Al ser `security definer` y no recibir precio, llamar a la función directamente por API (sin pasar por el Server Action) no permite pagar menos de lo que marca `avatar_precios`; como mucho, dispara el mismo canje que haría la UI.
- RLS: `coin_transactions` y `avatar_unlocks` — `select`/`insert` solo si `auth.uid() = profile_id`; sin `update`/`delete` (igual que `scores`). El insert directo a `coin_transactions` con `reason = 'canje_avatar'` no está permitido por policy — solo lo hace el RPC (`security definer`, bypassa RLS con su propia validación). `avatar_precios` es de solo lectura para `authenticated` (sin policy de insert/update/delete vía API; se mantiene por migración).

## Plan de implementación

1. **Migración.** Crear `coin_transactions`, `coin_balance`, `avatar_unlocks`, `avatar_precios` (con sus filas seed, una por avatar del catálogo), columna `profiles.avatar_id`, RLS y la función `canjear_avatar(p_avatar_id)`. Prueba manual: desde el SQL editor, insertar una transacción `'partida'` y comprobar que `coin_balance` refleja el saldo; llamar a `canjear_avatar` con saldo insuficiente y comprobar que falla sin escribir nada; llamar con un `avatar_id` que no exista en `avatar_precios` y comprobar que falla igual.
2. **Catálogo de avatares.** `lib/avatars.ts` con 10-15 entradas (`id`, `nombre`, `precio`, `src`), assets pixel-art nuevos bajo `public/avatars/`, con los mismos `id` y `precio` que las filas seed de `avatar_precios`. Prueba manual: `import` sin errores de tipos.
3. **Monedas al guardar partida.** En `saveScore`, tras el insert en `scores`, calcular `delta = Math.min(100, Math.floor(score / 10))` e insertar en `coin_transactions` (`reason: 'partida'`, `game_id`). Si falla el insert de monedas, no revertir la puntuación ya guardada (son dos hechos independientes); solo loguear. Prueba manual: jugar una partida, guardar puntuación, comprobar en base de datos que aparece la fila de `coin_transactions` con el `delta` esperado.
4. **Server Actions de `/perfil`.** `canjearAvatar(avatarId)` llama al RPC pasando solo el `avatarId` (el precio lo resuelve la función en base de datos) y revalida `/perfil`; `equiparAvatar(avatarId)` comprueba `avatar_unlocks` antes de hacer `update profiles`. Prueba manual: canjear un avatar sin saldo da error legible; con saldo, resta el saldo y aparece en desbloqueados; equipar uno no desbloqueado falla.
5. **Página `/perfil`.** Sin sesión: mensaje invitando a iniciar sesión (mismo tono que el resto del sitio), sin redirect duro. Con sesión: saldo arriba, grid de avatares con tres estados visuales (bloqueado con precio, desbloqueado, equipado), botón según estado. Prueba manual: recorrer los tres estados con una cuenta de prueba.
6. **Nav (SPEC 14).** `getSessionUser()` resuelve `avatarId` y la imagen a mostrar con prioridad `avatar_id` del catálogo > `avatar_url` OAuth > icono genérico. El bloque avatar+nombre del nav pasa a enlazar a `/perfil`. Prueba manual: equipar un avatar del catálogo y comprobar que sustituye a la foto de Google/GitHub en el nav.
7. **Verificación final.** `npm run build`, `npm run lint`.

## Criterios de aceptación

- [ ] Al guardar una puntuación con sesión iniciada, el saldo de monedas del jugador sube en `min(100, floor(score / 10))`.
- [ ] Guardar una puntuación sin sesión no crea ninguna fila de monedas (igual que hoy no guarda `scores`).
- [ ] `/perfil` sin sesión muestra invitación a iniciar sesión, sin error ni pantalla en blanco.
- [ ] `/perfil` con sesión muestra el saldo actual y el catálogo completo con su estado real (bloqueado/desbloqueado/equipado).
- [ ] Canjear un avatar con saldo suficiente resta su precio del saldo y lo deja marcado como desbloqueado, de forma persistente entre recargas.
- [ ] Canjear un avatar sin saldo suficiente no cambia el saldo ni desbloquea nada, y muestra un mensaje de error.
- [ ] Canjear dos veces el mismo avatar la segunda vez no vuelve a cobrar (ya está desbloqueado).
- [ ] Equipar un avatar desbloqueado lo muestra en el nav en vez del icono genérico o la foto OAuth.
- [ ] Intentar equipar (vía Server Action) un avatar no desbloqueado no tiene efecto.
- [ ] Sin `avatar_id` en el perfil, el nav se comporta exactamente igual que en SPEC 14 (foto OAuth o icono genérico).
- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Sí:** ledger insert-only (`coin_transactions` + vista `coin_balance`) en vez de una columna `coins` mutable en `profiles`. Deja rastro auditable de cada movimiento y sigue el mismo patrón que `hall_of_fame`; el coste es una vista extra, asumible.
- **Sí:** tope de 100 monedas por partida, en el Server Action y reforzado con `check` en base de datos. Acota el daño de una puntuación falsa sin resolver el problema de origen (fuera de alcance).
- **Sí:** canje vía función `security definer` (`canjear_avatar`) en vez de insert directo desde el cliente. Evita condiciones de carrera (dos canjes simultáneos con el mismo saldo) y evita que RLS por sí sola tenga que validar saldo suficiente en el mismo `insert`.
- **Sí:** el precio vive en `avatar_precios` (tabla) y la función lo lee ella misma, sin recibirlo como argumento. Si el precio fuera un parámetro del RPC, cualquiera con las claves públicas podría llamarlo por API saltándose el Server Action y pagar lo que quisiera; con el precio fijado en base de datos, como mucho dispara el mismo canje que la UI ofrece.
- **Sí:** catálogo de avatares como archivo estático (`lib/avatars.ts`), no tabla en base de datos. Mismo patrón que `lib/games.ts`; no hay necesidad de gestionarlo desde fuera del repo todavía.
- **No:** subida de avatar propio. Añadiría storage y moderación de contenido; fuera de alcance, ya descartado también en SPEC 14.
- **No:** logros como fuente de monedas en esta spec. `reason` en `coin_transactions` ya deja hueco (`check in (...)`) para añadir `'logro'` el día que llegue, sin migrar de nuevo la tabla entera.
- **Sí:** el avatar_id del catálogo tiene prioridad sobre la foto OAuth cuando ambos existen. El jugador que se ha molestado en canjear un avatar espera verlo puesto, no que la foto de Google lo tape.
- **Sí:** el bloque avatar+nombre del nav deja de ser puramente decorativo (SPEC 14) y enlaza a `/perfil`. Es el único sitio natural para llegar a la tienda; no se crea una entrada de menú nueva para esto.
