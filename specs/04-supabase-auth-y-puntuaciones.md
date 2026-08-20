# SPEC 04 — Supabase: autenticación real y puntuaciones persistentes

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-20
> **Objetivo:** Sustituir la sesión y las puntuaciones falsas de `localStorage` por Supabase Auth (email + contraseña) y dos tablas en Postgres (`profiles`, `scores`) con RLS, de modo que `/acceso`, el nav, el reproductor y el Salón de la Fama trabajen con datos reales.

## Por qué existe esta spec

Todo lo que la plataforma promete —"juega online y compite por puntuación"— es hoy una maqueta:

- `lib/session.ts` guarda `{ name }` en `localStorage` bajo `av_user`. **No hay contraseña**: `components/auth-form.tsx` llama a `signIn(name || "PLAYER1")` y entra quien sea, con el campo vacío incluido.
- Las puntuaciones (`av_scores`) viven en el navegador de cada jugador. Nadie compite contra nadie.
- `lib/scores.ts` genera 12 filas por juego con un LCG semillado copiado de `references/data.jsx`. El Salón de la Fama es decorado: `Z3R0COOL` no existe.
- Los botones `GOOGLE` y `GITHUB` de `/acceso` no hacen absolutamente nada.

Esta spec convierte todo eso en real. Es el primer código del proyecto con base de datos: entran dos dependencias (`@supabase/supabase-js`, `@supabase/ssr`), un fichero `proxy.ts` en la raíz, migraciones SQL versionadas y políticas RLS.

El proyecto de Supabase ya existe (`hwtvqgdghgplthkcvfoq`, declarado en `.mcp.json`) y su esquema `public` está **vacío**: se parte de cero.

> **Aviso de versión.** Next.js 16 **renombró Middleware a Proxy**: el fichero es `proxy.ts` en la raíz, no `middleware.ts`. La documentación de `@supabase/ssr` sigue hablando de `middleware.ts` y de `createMiddlewareClient`; hay que traducirla. Ver `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` y `node_modules/next/dist/docs/01-app/02-guides/authentication.md` antes de escribir nada, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- Cableado de Supabase: dependencias, variables de entorno, cliente de navegador, cliente de servidor y `proxy.ts` que refresca la cookie de sesión.
- **Auth por email + contraseña.** Registro (usuario + email + contraseña) e inicio de sesión (email + contraseña) reales en `/acceso`, con errores visibles y estado de envío.
- **Tabla `public.profiles`** creada por un trigger sobre `auth.users`, con `username` único que conserva la regla actual: mayúsculas, sin espacios extra, máximo 10 caracteres.
- **Tabla `public.scores`**, una fila por partida guardada, con RLS.
- Guardado de puntuación desde el reproductor mediante un **Server Action**; si no hay sesión, se invita a entrar en vez de guardar.
- **Salón de la Fama real**: lee de la base de datos, con estado vacío cuando no hay marcas.
- Nav y `SessionProvider` conectados a la sesión de Supabase, incluido cerrar sesión de verdad.
- Migraciones SQL versionadas en `supabase/migrations/`, aplicadas con la herramienta MCP `apply_migration`.
- Borrado del código muerto: `lib/scores.ts` completo y las funciones de `localStorage` de `lib/session.ts`.

**Fuera (otra spec si llega):**

- **Realtime** (Salón de la Fama que se actualiza solo) y **Edge Functions**. Confirmado como siguiente paso, no como parte de esta spec.
- OAuth con Google y GitHub. Los botones se quedan, pero `disabled`.
- Confirmación de email, recuperación de contraseña y cambio de email.
- Página de perfil, avatares, cambio de nick después del registro y borrado de cuenta.
- Migrar a la base de datos lo que hubiera en `localStorage`: se descarta sin avisar.
- Validación anti-trampas de la puntuación (rango, límite de frecuencia, firma). Decisión explícita del usuario: no entra ahora. Ver _Riesgos_.
- Puntuaciones de invitados: sin sesión no se guarda nada.
- Proteger rutas con redirección: `/juegos`, el reproductor y `/salon` siguen abiertos sin cuenta.
- Paginación del Salón de la Fama y filtros más allá de las pestañas por juego que ya existen.
- Cualquier cambio en `/acerca` y su formulario de contacto (SPEC 03).
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

### Base de datos

Dos migraciones en `supabase/migrations/`, con nombre `<timestamp>_<slug>.sql`.

**`profiles`** — un perfil por usuario de `auth.users`:

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint username_formato check (username ~ '^[A-Z0-9_]{3,10}$')
);
```

El perfil lo crea un trigger `on auth.users` (`after insert`), función `public.handle_new_user()` con `security definer` y `set search_path = ''`, que lee el `username` de `new.raw_user_meta_data->>'username'`.

**`scores`** — una fila por partida guardada:

```sql
create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index scores_ranking_idx on public.scores (game_id, score desc);
```

`game_id` es el `id` de `lib/games.ts` (`caida`, `serpentina`, …). **No** hay tabla de juegos: el catálogo sigue siendo el fichero TypeScript y no se duplica en la base de datos.

**RLS**, activado en las dos tablas:

| Tabla      | Política          | Regla                                               |
| ---------- | ----------------- | --------------------------------------------------- |
| `profiles` | `select`          | pública (`true`) — el Salón necesita mostrar nicks  |
| `profiles` | `update`          | `auth.uid() = id`                                   |
| `profiles` | `insert`/`delete` | ninguna: solo el trigger, que es `security definer` |
| `scores`   | `select`          | pública (`true`)                                    |
| `scores`   | `insert`          | `auth.uid() = user_id`                              |
| `scores`   | `update`/`delete` | ninguna: una marca no se edita ni se borra          |

**Vista `public.hall_of_fame`** — mejor marca por jugador y juego, que es lo que la pantalla necesita:

```sql
create view public.hall_of_fame
with (security_invoker = on) as
select distinct on (s.game_id, s.user_id)
  s.game_id, s.user_id, p.username, s.score, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;
```

### Tipos en la app

`lib/supabase/types.ts` se **genera** con la herramienta MCP `generate_typescript_types` y se versiona. Sobre él, en `lib/scores-db.ts`:

```ts
/** Fila del Salón de la Fama tal y como la pinta la pantalla. */
export type HallRow = {
  rank: number;
  username: string;
  score: number;
  /** dd/mm/aaaa, mismo formato que las filas mock que sustituye. */
  date: string;
  /** true si la fila es del usuario que mira la página. */
  isMine: boolean;
};
```

Y en `app/juegos/[id]/jugar/actions.ts`:

```ts
export type SaveScoreState =
  | { status: "idle" }
  | { status: "ok"; score: number }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };
```

### Sesión en la app

`SessionValue` (en `components/session-provider.tsx`) pasa a ser:

```ts
type SessionValue = {
  user: { id: string; username: string } | null;
  signOut: () => Promise<void>;
};
```

`signIn`, `saveScore` y `scoresFor` desaparecen del contexto: lo primero lo hace `/acceso` contra Supabase, lo segundo un Server Action y lo tercero una consulta de servidor.

### Variables de entorno

`.env.template` gana dos claves y **pierde** `SUPABASE_DB_PASSWORD` (nadie la lee):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Las de Resend (SPEC 03) se quedan igual. No entra ninguna clave `service_role`/secret: toda la seguridad recae en RLS.

## Plan de implementación

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Actualizar `.env.template`: añadir las dos claves `NEXT_PUBLIC_SUPABASE_*` con un comentario de dónde salen (Project Settings → API), quitar `SUPABASE_DB_PASSWORD` y dejar el fichero con salto de línea final. Rellenar `.env.local` con los valores reales (`get_project_url` y `get_publishable_keys` del MCP). Prueba manual: `npm run build` sigue pasando.
2. **Migración del esquema.** Escribir `supabase/migrations/<ts>_perfiles_y_puntuaciones.sql` con las dos tablas, el índice, el trigger `handle_new_user`, el `alter table … enable row level security` y todas las políticas de la tabla de arriba. Aplicarla con `apply_migration`. Prueba manual: `list_tables` muestra `profiles` y `scores`; `get_advisors` con `type: "security"` no reporta tablas sin RLS.
3. **Vista del ranking.** Segunda migración `<ts>_vista_hall_of_fame.sql` con la vista `hall_of_fame` (`security_invoker = on`). Aplicarla con `apply_migration`. Prueba manual: `execute_sql` con `select * from hall_of_fame` devuelve 0 filas sin error.
4. **Configuración del proyecto.** Desactivar **Confirm email** en Authentication → Providers → Email del panel de Supabase, para que la cuenta quede activa al registrarse. Documentarlo en un comentario de `.env.template` (es configuración del proyecto, no del repo: quien despliegue otro proyecto debe repetirlo).
5. **Tipos generados.** Ejecutar `generate_typescript_types` y guardar el resultado en `lib/supabase/types.ts`. Prueba manual: `npx tsc --noEmit` pasa.
6. **Clientes de Supabase.** Crear `lib/supabase/client.ts` (`createBrowserClient`, para componentes cliente) y `lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`, para server components y Server Actions), ambos tipados con `Database`. Consultar antes `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
7. **Proxy de sesión.** Crear `proxy.ts` en la raíz del proyecto —**no** `middleware.ts`: Next 16 renombró Middleware a Proxy— que refresque la cookie de sesión en cada petición y devuelva la respuesta con las cookies actualizadas, con el `matcher` estándar que excluye `_next/static`, `_next/image`, `favicon.ico` y ficheros de imagen. Prueba manual: navegar entre rutas no cierra la sesión y `document.cookie` conserva la de Supabase.
8. **Auth en `/acceso`.** Crear `app/acceso/actions.ts` (`"use server"`) con `signUp` y `signIn`, ambos `(prev, formData) => Promise<AuthState>`:
   - `signIn`: email + contraseña → `supabase.auth.signInWithPassword`.
   - `signUp`: normaliza el usuario (mayúsculas, `trim`, 10 caracteres) y valida contra `^[A-Z0-9_]{3,10}$` antes de llamar a `supabase.auth.signUp` con `options.data.username`; si el `username` ya existe, el `insert` del trigger falla y hay que devolver el error `EL NOMBRE DE JUGADOR YA ESTÁ OCUPADO.` en vez del error crudo de Postgres.
   - Ambos terminan con `revalidatePath("/", "layout")` y `redirect("/")` en el caso correcto.
     Reescribir `components/auth-form.tsx` con `useActionState`: la pestaña **INICIAR SESIÓN** pide **email + contraseña** (el campo `Usuario` desaparece de esa pestaña); **CREAR CUENTA** pide usuario + email + contraseña. Botón deshabilitado mientras se envía, mensaje de error visible sobre el botón y campos que conservan lo escrito. `JUGAR COMO INVITADO` deja de llamar a `signOut` y solo navega a `/`. Los botones `GOOGLE` y `GITHUB` pasan a `disabled` con `title="Próximamente"`. Prueba manual: registrar una cuenta nueva entra directo; repetir el mismo nick da el error de nick ocupado; contraseña incorrecta da error y no navega.
9. **Sesión en la app.** Reescribir `components/session-provider.tsx`: recibe el usuario inicial por props desde `app/layout.tsx` (que lo lee en servidor con `lib/supabase/server.ts` más el `username` de `profiles`), se suscribe a `onAuthStateChange` para reaccionar a login/logout en otras pestañas y expone `{ user, signOut }`. `signOut` llama a `supabase.auth.signOut()` y refresca la ruta. Actualizar `components/nav.tsx` para usar el nuevo contexto (el nombre mostrado es `user.username`) y hacer que la opción de cerrar sesión funcione de verdad. Prueba manual: tras iniciar sesión el nav muestra el nick sin parpadeo de "no logueado" al recargar; cerrar sesión lo devuelve a `Iniciar Sesión`.
10. **Limpieza de `localStorage`.** Borrar `lib/scores.ts` entero y de `lib/session.ts` todo lo relacionado con `localStorage` (`readUser`, `writeUser`, `clearUser`, `readScores`, `writeScores`, las constantes `av_user`/`av_scores` y el tipo `SavedScore`), conservando `normalizeName`, que se reutiliza en el registro. Prueba manual: `grep -r "av_user\|av_scores\|seededScores" app components lib` no devuelve nada y `npm run build` pasa.
11. **Guardar puntuación.** Crear `app/juegos/[id]/jugar/actions.ts` con `saveScore(prev, formData)`: comprueba sesión (sin ella devuelve `{ status: "unauthenticated" }` sin tocar la base de datos), inserta `{ user_id: user.id, game_id, score }` y revalida `/salon`. Adaptar `components/game-player.tsx`: el botón de guardar usa `useActionState`, muestra `▶ GUARDANDO…` mientras envía, confirma al terminar y, si no hay sesión, sustituye el formulario por un aviso con enlace a `/acceso`. El nombre que se pinta en la pantalla final sale de la sesión (`INVITADO` si no la hay), no de un campo escribible. Prueba manual: partida sin sesión → aviso con enlace; con sesión → la fila aparece en `scores` (`execute_sql`).
12. **Salón de la Fama real.** Crear `lib/scores-db.ts` con `getHallOfFame(gameId, userId)`, que consulta la vista `hall_of_fame` ordenando por `score desc`, limita a 12 filas y las mapea a `HallRow` (`rank` por posición, `date` en `dd/mm/aaaa`, `isMine` comparando `user_id`). Convertir `app/salon/page.tsx` en un server component que acepta el juego por `searchParams` (`PageProps<"/salon">`), carga las filas y se las pasa a `components/hall-of-fame.tsx`, que deja de ser `"use client"` para la parte de datos: las pestañas por juego pasan a ser enlaces `/salon?juego=<id>`. Si no hay filas, mostrar el estado vacío `NADIE HA MARCADO AÚN EN ESTE JUEGO` con enlace a la ficha del juego. Prueba manual: guardar dos marcas del mismo juego con la misma cuenta deja **una** fila (la mejor) en el Salón; con otra cuenta aparecen dos filas ordenadas por puntuación.
13. **Repaso de seguridad y responsive.** Ejecutar `get_advisors` con `type: "security"` y `type: "performance"` y resolver lo que reporte. Verificar `/acceso` y `/salon` a 1440 px, 900 px y 375 px: sin scroll horizontal y sin desbordes en la tabla del Salón. Comprobar con `grep` sobre `.next/static` que no aparece ninguna clave que no sea la publishable.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `list_tables` sobre `public` devuelve `profiles` y `scores`, ambas con RLS activado, y `get_advisors` (`security`) no reporta tablas sin RLS ni vistas `security definer`.
- [ ] `supabase/migrations/` contiene los ficheros `.sql` versionados que reproducen el esquema completo desde cero.
- [ ] Registrar una cuenta con usuario, email y contraseña deja al jugador dentro de la aplicación **sin** pasar por ningún correo de confirmación, y crea automáticamente su fila en `profiles`.
- [ ] Intentar registrar un `username` que ya existe muestra `EL NOMBRE DE JUGADOR YA ESTÁ OCUPADO.` y **no** crea usuario nuevo en `auth.users`.
- [ ] Un `username` con menos de 3 caracteres, más de 10, o con caracteres fuera de `A-Z 0-9 _`, se rechaza en el registro.
- [ ] Iniciar sesión con email y contraseña correctos entra; con contraseña incorrecta muestra un error visible, conserva el email escrito y no navega.
- [ ] La pestaña `INICIAR SESIÓN` no contiene ningún campo `Usuario`.
- [ ] Los botones `GOOGLE` y `GITHUB` están `disabled` y no disparan ninguna acción al pulsarlos.
- [ ] Tras recargar la página con sesión iniciada, el nav muestra el nick **desde el primer paint**, sin parpadeo a `Iniciar Sesión`.
- [ ] Cerrar sesión desde el nav borra la sesión de verdad: recargar no la recupera y `/salon` deja de marcar ninguna fila como propia.
- [ ] Terminar una partida sin sesión muestra un aviso con enlace a `/acceso` y **no** inserta ninguna fila en `scores`.
- [ ] Terminar una partida con sesión y guardar inserta exactamente una fila en `scores` con el `user_id` correcto, y la marca aparece en `/salon` sin recargar a mano.
- [ ] Un intento de `insert` en `scores` desde el navegador con un `user_id` ajeno es rechazado por RLS.
- [ ] Con dos marcas del mismo jugador en el mismo juego, el Salón muestra **una** fila con la puntuación más alta.
- [ ] `/salon` sin ninguna marca para el juego seleccionado muestra el estado vacío, no una tabla en blanco ni filas inventadas.
- [ ] `grep -r "av_user\|av_scores\|seededScores" app components lib` no devuelve resultados, y `lib/scores.ts` ya no existe.
- [ ] `.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales, y ya no contiene `SUPABASE_DB_PASSWORD`.
- [ ] Ninguna clave secreta ni `service_role` aparece en `.next/static` ni en el HTML servido.
- [ ] Existe `proxy.ts` en la raíz y **no** existe `middleware.ts`.
- [ ] `/`, `/juegos`, `/juegos/caida`, `/juegos/caida/jugar` y `/acerca` siguen respondiendo igual que antes de esta spec, y el formulario de contacto sigue enviando.
- [ ] A 375 px de ancho, `/acceso` y `/salon` no producen scroll horizontal.
- [ ] No aparece ningún error de hidratación en consola en `/`, `/acceso` ni `/salon`.

## Decisiones tomadas y descartadas

- **Sí:** auth y puntuaciones en la misma spec. Decisión del usuario tras plantear la partición: una tabla `scores` sin auth real no tendría a quién atribuir la marca ni cómo protegerla con RLS.
- **No:** Realtime y Edge Functions ahora. Confirmadas como siguiente paso, pero cada una es una spec propia; meterlas aquí triplicaría la superficie.
- **Sí:** email + contraseña. Es lo que ya pinta `/acceso` y no depende de configurar proveedores externos ni de que el correo salga.
- **No:** magic link. El SMTP por defecto de Supabase permite 2-3 correos por hora: en pruebas parece que está roto.
- **No:** OAuth con Google/GitHub ahora. Exige registrar apps y URLs de callback fuera del repo. Los botones se quedan `disabled` en vez de desaparecer, a petición del usuario, para conservar la composición de la referencia.
- **Sí:** iniciar sesión por email. Resolver `username → email` antes de autenticar obligaría a exponer una consulta pública que revela qué nicks existen.
- **Sí:** confirmación de email desactivada. La cuenta queda activa al instante y no hay pantalla de "revisa tu correo" ni ruta de callback que mantener.
- **Sí:** tabla `profiles` con trigger sobre `auth.users`. Permite unicidad real del nick y `join` desde el ranking.
- **No:** guardar el nick en `raw_user_meta_data`. No se puede garantizar unicidad ni consultarlo desde otras tablas.
- **No:** derivar el nick del email. El jugador perdería el control de cómo aparece en el Salón.
- **Sí:** una fila por partida en `scores` más una vista `hall_of_fame` que reduce a la mejor marca. Deja abierto un futuro "tus últimas partidas" sin migrar el esquema.
- **No:** una única fila por `(user_id, game_id)` con `upsert`. Tabla más pequeña, pero el historial se pierde para siempre.
- **Sí:** vista con `security_invoker = on`. Sin ello, la vista se ejecutaría con los permisos de quien la creó y saltaría el RLS de las tablas que consulta.
- **Sí:** escritura de puntuaciones por Server Action. Un solo punto de entrada, coherente con `app/acerca/actions.ts` de la SPEC 03.
- **No:** `insert` directo desde el navegador. Menos código, pero deja la escritura sin ninguna capa donde validar más adelante.
- **Sí:** el catálogo de juegos sigue en `lib/games.ts`. Duplicarlo en una tabla obligaría a mantener dos fuentes de verdad y a migrar cada vez que se añade un juego.
- **Sí:** borrar `lib/scores.ts` y no mezclar filas falsas con reales. Un ranking a medias inventado es peor que uno vacío: nadie entendería por qué no adelanta a `Z3R0COOL`.
- **No:** sembrar las filas falsas en la base de datos. Dejaría cuentas fantasma sin usuario detrás.
- **Sí:** descartar sin avisar lo que hubiera en `localStorage`. Son datos de un prototipo sin usuarios reales; migrarlos añade un camino de código que se ejecuta una vez y no se puede probar.
- **Sí:** jugar sin cuenta sigue permitido; guardar exige sesión. Mantiene la demo pública de la plataforma y el botón `JUGAR COMO INVITADO` que ya existe.
- **No:** puntuaciones anónimas. Harían el ranking trivial de falsear y obligarían a permitir escrituras sin autenticar.
- **No:** proteger rutas con redirección desde `proxy.ts`. El proxy solo refresca la sesión; la documentación de Next desaconseja usarlo como solución de autorización.
- **Sí:** `proxy.ts` en vez de `middleware.ts`. Es la convención de Next.js 16; la documentación de `@supabase/ssr` está desactualizada en este punto.
- **Sí:** sesión leída en servidor y pasada al `SessionProvider`. Evita el parpadeo de "no logueado" en cada carga y permite consultas de servidor con el usuario ya resuelto.
- **Sí:** solo URL y publishable key en el entorno. Toda la seguridad recae en RLS; una clave `service_role` filtrada es acceso total a la base de datos.
- **Sí:** quitar `SUPABASE_DB_PASSWORD` de `.env.template`. Está sin usar y ningún código de la aplicación la lee.
- **Sí:** tipos generados con el MCP y versionados en `lib/supabase/types.ts`. Escribirlos a mano garantiza que se desincronicen.
- **No:** validación anti-trampas de la puntuación (rango, límite de frecuencia). Decisión explícita del usuario: no entra ahora. Queda registrada como riesgo asumido.
- **No:** Supabase CLI con stack local en Docker. Añade un flujo y una dependencia nuevos; el MCP ya cubre aplicar migraciones versionadas.
- **No:** aplicar SQL suelto por MCP sin fichero en el repo. El esquema dejaría de ser reproducible.

## Riesgos

| Riesgo                                                                                                                                                    | Mitigación                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sin validación en servidor, cualquiera puede inscribir la puntuación que quiera** llamando al Server Action desde la consola                            | Asumido por decisión explícita del usuario. RLS garantiza al menos que la marca se atribuye a quien la envía y no a un tercero. La validación de rango, el `game_id` contra `lib/games.ts` y el límite de frecuencia son la primera candidata a spec de seguimiento. |
| La documentación de `@supabase/ssr` habla de `middleware.ts` y de APIs de cookies que Next 16 cambió: copiar y pegar produce sesiones que no se refrescan | Leer `16-proxy.md` y `authentication.md` de `node_modules/next/dist/docs/` antes de escribir el proxy, y verificar con el criterio de aceptación de la sesión persistente.                                                                                           |
| El trigger `handle_new_user` falla (nick duplicado o formato inválido) y deja un usuario en `auth.users` sin fila en `profiles`                           | El Server Action valida el formato antes de llamar a `signUp` y traduce el error de unicidad a un mensaje legible; el `check` de la tabla es la última red. Verificado por el criterio de nick ocupado.                                                              |
| Una función `security definer` sin `set search_path = ''` es un vector de escalada de privilegios                                                         | La migración lo incluye explícitamente y `get_advisors` (`security`) lo comprueba en el paso 13.                                                                                                                                                                     |
| Desactivar la confirmación de email permite registrarse con direcciones que no existen                                                                    | Aceptado: no se envía ningún correo al jugador en esta fase. Si más adelante hay notificaciones, la confirmación vuelve con su propia spec.                                                                                                                          |
| La vista `hall_of_fame` sin `security_invoker` expondría filas saltándose RLS                                                                             | Se declara `with (security_invoker = on)` y se comprueba con `get_advisors`.                                                                                                                                                                                         |
| Convertir `hall-of-fame.tsx` en server component rompe las pestañas por juego, que hoy son estado de cliente                                              | Las pestañas pasan a enlaces `/salon?juego=<id>`; el criterio de aceptación del estado vacío y el de responsive cubren la pantalla resultante.                                                                                                                       |
| El proyecto de Supabase es uno solo, compartido entre desarrollo y lo que se despliegue: una migración equivocada afecta a los datos reales               | Las migraciones van versionadas y se aplican una a una revisando `list_migrations`. Separar entornos con ramas de Supabase es materia de otra spec.                                                                                                                  |
| `.env.local` mal configurado hace que la aplicación falle en el arranque con un error poco claro                                                          | Los clientes leen las variables una sola vez y `.env.template` documenta de dónde sale cada valor.                                                                                                                                                                   |

## Lo que **no** entra en esta spec

- Realtime y Edge Functions.
- OAuth con Google y GitHub (los botones quedan deshabilitados).
- Confirmación de email, recuperación y cambio de contraseña.
- Página de perfil, avatares, cambio de nick y borrado de cuenta.
- Validación anti-trampas de las puntuaciones.
- Puntuaciones de invitados y protección de rutas por redirección.
- Migración de los datos de `localStorage`.
- Paginación y filtros adicionales del Salón de la Fama.
- Separación de entornos con ramas de Supabase.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
