# SPEC 01 — MVP visual: las cinco pantallas de Arcade Vault

> **Estado:** Implementada
> **Depende de:** —
> **Fecha:** 2026-08-19
> **Objetivo:** Portar las cinco pantallas del prototipo de `references/` a rutas reales de Next.js 16 (biblioteca, detalle, reproductor, acceso y salón de la fama), sin implementar ningún juego.

## Por qué existe esta spec

El repo es el scaffold de Next.js, pero `app/globals.css` (975 líneas) y `app/layout.tsx` ya tienen portado el sistema visual del prototipo: tokens de color, fuentes (`Press Start 2P`, `JetBrains Mono`, `Courier Prime`), fondo `.av-bg` + `.av-noise` y todas las clases de componente (`.card`, `.crt`, `.podium`, `.auth-card`…). Falta el árbol de rutas y los componentes React. Esta spec cubre exactamente ese hueco.

El prototipo de `references/` es React 18 UMD con Babel en el navegador, routing por `location.hash` y globales en `window`. Nada de eso se conserva: se traduce a App Router, TypeScript estricto y módulos.

## Alcance

**Dentro:**

- Cinco rutas reales del App Router: `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon`.
- Nav global (con panel lateral móvil) y footer en `app/layout.tsx`, presentes en las cinco rutas.
- Datos mock tipados: los 8 juegos y el generador determinista de puntuaciones.
- Sesión falsa y puntuaciones guardadas en `localStorage` (`av_user`, `av_scores`).
- Simulación de partida en el reproductor: ~20 s, HUD vivo, pausa y modal de fin de juego.
- `not-found.tsx` con estética arcade para ids de juego inexistentes.
- Comportamiento responsive de las cinco pantallas (los media queries ya están en `globals.css`).

**Fuera de alcance (para futuras specs):**

- Cualquier juego jugable de verdad. La arena CRT es decorativa.
- Backend, base de datos, autenticación real, OAuth de Google/GitHub (los botones son inertes).
- Puntuaciones compartidas entre usuarios: el ranking global sigue siendo mock determinista.
- El contador de `CRÉDITOS · 03`: se pinta fijo, no hay economía de créditos.
- Reescribir el CSS existente a utilidades de Tailwind.
- Tests automatizados (el proyecto no tiene framework de tests).

## Modelo de datos

Dos módulos nuevos en `lib/`.

`lib/games.ts`:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string; // "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string; // texto de tarjeta
  long: string; // texto de detalle
  cat: GameCategory;
  cover: string; // clase CSS: "cover-bricks"
  color: GameColor; // color del botón JUGAR
  best: number;
  plays: string; // "12.4K"
};

export const GAMES: Game[]; // los 8 juegos de references/data.jsx, sin cambios
export const CATS: readonly string[]; // ["TODOS", ...GameCategory]
export function getGame(id: string): Game | undefined;
```

`lib/scores.ts`:

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // "dd/mm/2026"
};

// Mismo LCG que references/data.jsx: misma semilla → mismas filas siempre.
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Las semillas se derivan del id igual que en la referencia: detalle `id.length * 17 + 3` con 10 filas, salón `id.length * 23 + 7` con 12 filas. El generador es puro y determinista, así que puede ejecutarse en el servidor sin desajuste de hidratación.

`lib/session.ts` — cliente, envuelve `localStorage`:

```ts
export type User = { name: string }; // "PX_KAI", máx. 10 caracteres
export type SavedScore = {
  game: string; // Game["id"]
  name: string;
  score: number;
  at: number; // Date.now()
};

// Claves: "av_user" (User | null), "av_scores" (SavedScore[])
```

Cada lectura va dentro de `try/catch`: si `localStorage` no está disponible o el JSON está corrupto, se devuelve `null` / `[]`.

## Plan de implementación

1. **Datos.** Crear `lib/games.ts` con los 8 juegos y las categorías, portados literalmente de `references/data.jsx`. Prueba manual: `npx tsc --noEmit` pasa.
2. **Puntuaciones mock.** Crear `lib/scores.ts` con `seededScores` tipado, mismo algoritmo LCG. Prueba manual: `seededScores(20, 12)` devuelve 12 filas ordenadas de mayor a menor con rangos 1..12.
3. **Sesión.** Crear `lib/session.ts` (helpers de `localStorage`) y `components/session-provider.tsx`: contexto cliente con `user`, `signIn`, `signOut`, `saveScore`, `scoresFor(gameId)`. El estado arranca en `null` y se hidrata en un `useEffect` para no romper la hidratación.
4. **Nav.** Crear `components/nav.tsx` (`"use client"`): logo, enlaces Biblioteca / Salón de la Fama con estado activo vía `usePathname`, contador de créditos fijo, botón de sesión (invitado → `/acceso`; con sesión → `NOMBRE ▾` que cierra sesión al pulsar) y panel lateral móvil con `useState`. Reusa las clases `.av-nav`, `.av-mobile-panel`, `.av-mobile-backdrop`.
5. **Layout.** Crear `components/site-footer.tsx` y montar `<SessionProvider>`, `<Nav />`, `<main className="av-main">` y el footer en `app/layout.tsx`, dentro del `.av-root` existente. Prueba manual: `npm run dev` muestra nav y footer sobre la página actual.
6. **Biblioteca.** Reescribir `app/page.tsx` como server component con el hero, y crear `components/library-browser.tsx` (`"use client"`) con buscador, chips de categoría, grid y estado vacío. Crear `components/game-card.tsx` (`"use client"`) con el tilt 3D del ratón; la tarjeta entera navega a `/juegos/[id]`. Prueba manual: filtrar por PUZZLE deja 1 tarjeta; buscar "zzz" muestra "NO HAY RESULTADOS".
7. **Detalle.** Crear `app/juegos/[id]/page.tsx` como server component tipado con `PageProps<"/juegos/[id]">`, que llama a `notFound()` si el id no existe. Portada, tags, descripción larga, `stat-strip`, acciones y leaderboard de 10 filas. Prueba manual: `/juegos/caida` renderiza; `/juegos/nope` cae en el 404.
8. **404.** Crear `app/not-found.tsx` con estética arcade ("GAME OVER · 404") y botón de vuelta a `/`.
9. **Reproductor — estructura.** Crear `app/juegos/[id]/jugar/page.tsx` (server, `notFound()` si no existe) que renderiza `components/game-player.tsx` (`"use client"`) con HUD, marco CRT, arena decorativa y barra inferior, todo estático de momento.
10. **Reproductor — simulación.** Añadir el bucle a `game-player.tsx`: el marcador sube cada 220 ms, el nivel sube cada 2500 puntos, se pierde una vida cada ~7 s y al llegar a 0 vidas se abre el modal de fin. Pausa congela los temporizadores; `FIN` corta la partida; `SALIR` vuelve al detalle. Prueba manual: dejar correr ~20 s abre el modal solo.
11. **Reproductor — guardado.** En el modal, campo de nombre (mayúsculas, máx. 10) y botón que llama a `saveScore` del contexto, muestra `▸ PUNTUACIÓN GUARDADA_` y ofrece `JUGAR DE NUEVO` / `VOLVER AL VAULT`. Prueba manual: tras guardar, `localStorage.av_scores` contiene la entrada.
12. **Acceso.** Crear `app/acceso/page.tsx` con `components/auth-form.tsx` (`"use client"`): pestañas Iniciar Sesión / Crear Cuenta (el campo correo aparece solo en la segunda), submit que llama a `signIn` y redirige a `/` con `useRouter`, botón de invitado, divisor y botones sociales inertes con `type="button"`.
13. **Salón de la Fama.** Crear `app/salon/page.tsx` con `components/hall-of-fame.tsx` (`"use client"`): chips por juego, podio 2-1-3, tabla de 12 filas con animación escalonada y, si hay sesión, la fila `▸ TU MEJOR MARCA EN …` construida a partir de la mejor entrada de `av_scores` para ese juego (si no hay ninguna, la fila no se pinta).
14. **Repaso responsive.** Verificar las cinco pantallas a 375 px: el panel lateral abre y cierra, la grid pasa a una columna, el detalle apila portada y leaderboard, y no hay scroll horizontal.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] Las cinco rutas responden: `/`, `/juegos/caida`, `/juegos/caida/jugar`, `/acceso`, `/salon`.
- [ ] La biblioteca muestra las 8 tarjetas; el chip `SHOOTER` deja exactamente 2; buscar "cai" deja exactamente 1.
- [ ] Buscar un texto sin coincidencias muestra el bloque "NO HAY RESULTADOS".
- [ ] Pulsar una tarjeta navega a `/juegos/[id]`, la URL cambia y el botón atrás del navegador vuelve a la biblioteca.
- [ ] `/juegos/id-inexistente` y `/juegos/id-inexistente/jugar` muestran la pantalla 404 arcade, no la de Next por defecto.
- [ ] El leaderboard de detalle muestra 10 filas y es idéntico entre recargas para el mismo juego.
- [ ] En el reproductor, el marcador aumenta solo y el modal `FIN DEL JUEGO` aparece sin intervención en menos de 30 s.
- [ ] `PAUSA` detiene el marcador y muestra el overlay `EN PAUSA`; `REANUDAR` lo reactiva.
- [ ] Guardar una puntuación escribe una entrada en `localStorage.av_scores` con `game`, `name`, `score` y `at`.
- [ ] Iniciar sesión desde `/acceso` escribe `localStorage.av_user`, redirige a `/` y el nav muestra el nombre en mayúsculas (máx. 10 caracteres).
- [ ] Pulsar el nombre en el nav borra `av_user` y el botón vuelve a `Iniciar Sesión`.
- [ ] Recargar la página conserva la sesión y no aparece ningún error de hidratación en consola.
- [ ] En `/salon`, cambiar de chip cambia podio y tabla; la tabla tiene 12 filas.
- [ ] Con sesión y una puntuación guardada en el juego seleccionado, aparece la fila `TU MEJOR MARCA`; sin puntuación guardada, no aparece.
- [ ] A 375 px de ancho: el botón `≡` abre el panel lateral, tocar el fondo lo cierra y ninguna pantalla produce scroll horizontal.
- [ ] No queda ningún resto del scaffold (`next.svg`, `vercel.svg`, textos en inglés) en `app/page.tsx`.

## Decisiones tomadas y descartadas

- **Sí:** rutas reales del App Router con `PageProps<...>`. URLs compartibles, botón atrás funcional y es lo que exige `CLAUDE.md`.
- **No:** routing por `location.hash` como el prototipo. Desperdicia el App Router y rompe las URLs compartibles.
- **No:** intercepting routes para mostrar `/acceso` como modal. Complejidad innecesaria en un MVP.
- **Sí:** reusar las clases de `app/globals.css`. Ya están portadas y probadas; garantiza fidelidad 1:1 con la referencia.
- **No:** reescribir el CSS a utilidades Tailwind. Mucho trabajo y riesgo alto de divergencia visual, sin beneficio en esta fase.
- **Sí:** `localStorage` con las claves `av_user` y `av_scores`, iguales a las del prototipo.
- **No:** cookies o sesión de servidor. No hay backend ni autenticación real que proteger.
- **Sí:** simulación de partida acotada (~20 s, tres vidas). Se pidió algo muy básico en vez del bucle infinito de la referencia; deja ver el modal de fin sin tener que pulsar `FIN`.
- **No:** juegos reales. Van en specs propias, uno por juego.
- **Sí:** `seededScores` ejecutado en el servidor. Es determinista, así que el HTML del servidor y el del cliente coinciden.
- **Sí:** fila "TU MEJOR MARCA" leída de `av_scores` real. Conecta reproductor y salón, y hace visible que guardar sirve para algo.
- **No:** la marca inventada de la referencia. Muestra datos falsos como si fueran del usuario.
- **Sí:** el botón de usuario del nav cierra sesión de un clic, como el prototipo. Un desplegable no existe en la referencia y habría que diseñarlo.

## Riesgos

| Riesgo                                                            | Mitigación                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desajuste de hidratación al leer `localStorage` durante el render | La sesión arranca en `null` y se hidrata en `useEffect`; el nav renderiza el estado de invitado en el primer paint.                                               |
| `localStorage` bloqueado (modo privado, cookies desactivadas)     | Todos los accesos van en `try/catch`; la app funciona sin persistir.                                                                                              |
| Las clases CSS portadas asumen una estructura DOM concreta        | Al portar cada pantalla se respeta el anidamiento exacto del `.jsx` de referencia; cualquier cambio de marcado se verifica contra `references/Arcade Vault.html`. |
| Next 16 cambia APIs de routing respecto al conocimiento previo    | Antes de escribir cada ruta se consulta `node_modules/next/dist/docs/01-app/`, como exige `AGENTS.md`.                                                            |
| Los temporizadores del reproductor siguen vivos al navegar fuera  | Cada `setInterval` se limpia en el retorno de su `useEffect`.                                                                                                     |

## Lo que **no** entra en esta spec

- Ningún juego jugable. La arena CRT es decoración.
- Autenticación real, backend, base de datos u OAuth.
- Ranking global compartido entre usuarios.
- Economía de créditos.
- Migración del CSS a utilidades Tailwind.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
