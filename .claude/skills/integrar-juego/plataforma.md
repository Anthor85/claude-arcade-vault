# Mapa de integración de un juego en Arcade Vault

Referencia para la skill `/integrar-juego`. Describe **qué toca cada juego nuevo**, qué
invariantes debe respetar y qué criterios de aceptación se repiten siempre. El caso ya
resuelto que sirve de modelo es Asteroides (SPEC 05).

---

## Puntos de integración

| Punto        | Archivo                          | Cambio                                                     |
| ------------ | -------------------------------- | ---------------------------------------------------------- |
| Motor        | `lib/engines/<slug>.ts`          | Nuevo. Exporta `<slug>Engine: GameEngine`                  |
| Registro     | `lib/engines/index.ts`           | Una línea en `ENGINES`, con `import()` diferido            |
| Contrato     | `lib/engines/types.ts`           | Solo si el juego necesita valores nuevos de `GameAction`   |
| Mando táctil | `components/game-player.tsx`     | `ACTION_FACE` y `STEERING`, solo si hay acciones nuevas    |
| Estilo mando | `components/player.module.css`   | Solo si el mando necesita una disposición distinta         |
| Catálogo     | `lib/games.ts`                   | Ficha nueva, o `id` y textos de una existente              |
| Portada      | `app/globals.css`                | `.cover-<slug>` con sus `::before` / `::after`             |
| Marcas       | `supabase/migrations/<ts>_*.sql` | Solo si cambia un `game_id` que ya tiene filas en `scores` |

Lo que **no** hay que tocar si el juego no aporta acciones nuevas: `components/game-player.tsx`
ya es genérico. La rama `CanvasArena`, el HUD, la pausa por `P` / `Escape` / `visibilitychange`,
el modal de fin de partida, el guardado con `saveScore` y el aviso para invitados funcionan
igual para cualquier motor registrado. Un juego sin motor cae en `MockArena` sin cambios.

`.game-canvas` (en `app/globals.css`) escala el canvas por CSS con `object-fit: contain` e
`image-rendering: pixelated`: la resolución interna del motor es fija y no depende de la
pantalla.

---

## Invariantes del contrato

Están documentados en la cabecera de `lib/engines/types.ts` y todo motor los cumple:

- `mount` no arranca ningún trabajo antes de ser llamado: importar el módulo no tiene
  efectos secundarios.
- El motor no escribe en el DOM fuera de su `<canvas>` ni pinta HUD ni overlays de estado:
  eso es de la plataforma.
- Los listeners de teclado los registra `mount` y los quita `destroy`.
- Los eventos (`onScore`, `onLives`, `onLevel`) se emiten solo cuando el valor **cambia**,
  no en cada frame.
- Tras `onGameOver` el motor deja de simular y no vuelve a emitir hasta un `restart`.

El `GameHandle` que devuelve `mount` expone `pause`, `resume`, `restart`, `end`, `setInput`
y `destroy`. `destroy` es idempotente.

---

## Patrón de port

Validado en `lib/engines/asteroids.ts`, port de un `game.js` de 587 líneas escritas como
script clásico:

| Original                                          | Port                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `document.getElementById('canvas')`               | `canvas` es parámetro de `mount`                                 |
| Estado en el ámbito global del fichero            | Variables locales del closure de `mount`                         |
| Clases sueltas que leen `ctx`, `W`, `H` globales  | Definidas dentro del closure, donde ya viven `ctx` y las medidas |
| `window.addEventListener('keydown', …)` al cargar | Registrado en `mount`, retirado en `destroy`                     |
| `drawHUD()`                                       | Eliminado: el HUD lo pinta React                                 |
| Overlay de fin de partida y reinicio con espacio  | Eliminados: el fin de partida es el modal de React               |
| `initGame(); requestAnimationFrame(loop);` final  | `mount` arranca el loop; `restart` vuelve a llamar a `initGame`  |

Detalles del port que conviene repetir:

- `ACTION_KEYS`: cada acción táctil escribe en la **misma tecla** que usaría el teclado, así
  que `setInput` no abre un segundo camino de input.
- `SCROLL_KEYS` con `preventDefault`, para que las flechas y el espacio no desplacen la
  página mientras se juega.
- Bandera `paused` que salta el `update` sin parar el `requestAnimationFrame`: al reanudar,
  las entidades no se teletransportan.
- `dt` en segundos y acotado (0.05 en Asteroides), para que una pestaña en segundo plano no
  produzca un salto de simulación.
- Sin `any`: el proyecto está en `strict`.

---

## Criterios de aceptación reutilizables

Copiar adaptando el nombre del juego, y añadir después los propios de su mecánica (reglas de
puntuación, condición de subida de nivel, condición de fin de partida):

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/<slug>.ts` no contiene ningún `any`.
- [ ] `/juegos/<slug>/jugar` muestra un canvas jugable con los controles declarados.
- [ ] La puntuación, las vidas y el nivel del HUD coinciden en todo momento con la partida, y
      **no** hay ningún HUD pintado dentro del canvas.
- [ ] El canvas no muestra overlays de fin de partida ni de reinicio.
- [ ] Terminar la partida abre el modal con la puntuación real conseguida.
- [ ] `PAUSA` congela el juego por completo y `REANUDAR` continúa sin saltos.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante.
- [ ] `JUGAR DE NUEVO` reinicia la partida sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y
      volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = '<slug>'` y
      aparece en `/salon?juego=<slug>`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor.
- [ ] A 375 px de ancho el juego se ve completo, sin recortes ni scroll horizontal.
- [ ] En un dispositivo de puntero grueso aparecen los controles táctiles y funcionan; en
      escritorio no se ven.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola.
- [ ] Los juegos sin motor siguen abriendo su maqueta sin errores.
- [ ] `references/started-games/` no tiene ninguna modificación introducida por la spec.

Si hay renombrado de `game_id`, añadir:

- [ ] `select count(*) from public.scores where game_id = '<id viejo>'` devuelve 0, y la
      migración correspondiente existe en `supabase/migrations/`.
- [ ] `grep -rn "<id viejo>" app components lib` no devuelve resultados.
