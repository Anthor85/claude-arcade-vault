# SPEC 11 — Ranaria jugable

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 08, SPEC 09
> **Fecha:** 2026-08-25
> **Origen:** port de `specs/game-jam/ranaria/03-ranaria-jugable.md` al contrato real de la plataforma
> **Objetivo:** Escribir `lib/engines/ranaria.ts` como un Frogger de rejilla —salto discreto de celda, carretera con tráfico, río de troncos y tortugas que se sumergen, cinco nenúfares que hay que ocupar para cerrar la ronda y cronómetro pintado dentro del canvas— y registrarlo para que `/juegos/ranaria/jugar` sea una partida real cuya puntuación se inscribe en el Salón de la Fama.

---

## Por qué existe esta spec

La plataforma tiene cuatro motores reales: Asteroides (SPEC 05), Caída (SPEC 06), Arkanoid (SPEC 07) y Serpentina (SPEC 08). `ranaria` sigue siendo una ficha de `lib/games.ts` sin motor: entrar en `/juegos/ranaria/jugar` cae en `MockArena`, la maqueta que sube la puntuación sola con un `setInterval`, y permite guardar en `scores` un número que nadie ha jugado.

No hay port: `references/started-games/` no contiene ningún Frogger. La lógica se escribe entera contra `GameEngine`.

### Qué se corrigió del origen

La spec `03-ranaria-jugable.md` describe su diseño de juego con detalle, pero apunta a una arquitectura que **este repositorio no tiene**. Esta spec conserva el diseño y traduce los puntos de integración:

| La spec 03 pedía                                                     | Aquí es                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `components/games/FroggerGame.tsx` con props React                   | `lib/engines/ranaria.ts` que exporta `ranariaEngine: GameEngine`                            |
| `app/games/frogger/play/page.tsx`                                    | Nada: `app/juegos/[id]/jugar` + `components/game-player.tsx` ya son genéricos               |
| `INSERT` de una fila `frogger` en una tabla `games`                  | Nada: la ficha `ranaria` ya está en `lib/games.ts` y `.cover-rana` en `globals.css`         |
| Modal propio, `localStorage av_player_name`, `insert` a mano         | Nada: el modal, el guardado con `saveScore` y el aviso de invitado son del reproductor      |
| HUD interno de score / vidas / nivel dentro del canvas ("doble HUD") | Prohibido por el contrato: esos tres los pinta React. Dentro del canvas, solo el cronómetro |
| `/hall-of-fame`                                                      | `/salon?juego=ranaria`                                                                      |
| `paused` como prop, `onScoreChange`, `onGameOver(finalScore)`        | `GameHandle.pause` / `resume` y los eventos `onScore`, `onLives`, `onLevel`, `onGameOver`   |

---

## Alcance

**Dentro:**

- `lib/engines/ranaria.ts` — motor completo contra `GameEngine`, sin `any`.
- Una línea en `ENGINES` de `lib/engines/index.ts`, con `import()` diferido.
- Actualizar `references/IMPLEMENTED_GAMES.MD`.

**Fuera:**

- Sprites bitmap o imágenes: todo se dibuja con primitivas de canvas.
- Skins `retro` y `neon`: el motor declara `skins: ["clasico"]` y las otras dos las añade después el subagente `skin-designer` (ver Decisiones).
- Audio: hay una spec transversal pendiente para los cuatro juegos.
- Power-ups del Frogger original: mosca bonus en el nenúfar, cocodrilo disfrazado de tronco, rana acompañante.
- Animaciones de muerte elaboradas (partículas, explosiones).
- Tocar `lib/engines/types.ts`, `ACTION_FACE`, `STEERING` o `components/player.module.css`: las cuatro direcciones absolutas ya existen en `GameAction` desde la SPEC 08 y la cruceta de la SPEC 09 las pinta tal cual.
- Tocar `lib/games.ts`, `app/globals.css` o migraciones: la ficha, la portada y el `game_id` ya existen y no cambian.

---

## Diseño del tablero

Rejilla de **16 columnas × 15 filas** de 40 px. Canvas **640 × 600**. Las 14 primeras filas son tablero; la fila 14 es la franja del cronómetro.

```ts
const COLS = 16;
const CELL = 40;
const BOARD_ROWS = 14; // filas jugables
const TIMER_H = CELL; // franja inferior del cronómetro
const W = COLS * CELL; // 640
const H = BOARD_ROWS * CELL + TIMER_H; // 600

// Filas, 0 = arriba
const ROW_GOALS = 0; // nenúfares
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6; // 6 carriles de río
const ROW_MEDIAN = 7; // mediana segura
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12; // 5 carriles de carretera
const ROW_START = 13; // orilla de salida
```

Los cinco nenúfares ocupan dos columnas cada uno, separados por una columna de orilla: bocas en `[1,2] [4,5] [7,8] [10,11] [13,14]`, orilla en `0, 3, 6, 9, 12, 15`. Aterrizar en la fila 0 sobre una columna de orilla es muerte.

---

## Reglas

**Movimiento.** La rana nace en `ROW_START`, columna 7. Cada pulsación de dirección la desplaza **exactamente una celda**, con una animación de salto de **120 ms** durante la cual no acepta otra pulsación. No puede salir por los bordes laterales ni por debajo de `ROW_START`. Las cuatro direcciones están permitidas, incluido el retroceso.

**Carretera** (filas 8–12). Cinco carriles de sentido alterno. Cada carril lleva coches (1 celda) o camiones (2–3 celdas) a velocidad propia, entre 1,5 y 4 px/frame equivalentes. Una entidad que sale por un borde reaparece por el opuesto. Tocar cualquiera es muerte.

**Río** (filas 1–6). Seis carriles de sentido alterno con troncos (2–4 celdas) y grupos de tortugas (2–3 celdas), a velocidad entre 1 y 3 px/frame equivalentes, con huecos de al menos una celda. En el río la rana **solo sobrevive si está apoyada** en un tronco o en tortugas emergidas, y se desplaza arrastrada por el apoyo a su velocidad real. Si el arrastre la saca por un borde lateral, muere.

**Tortugas.** Cada grupo tiene su propio ciclo independiente: **3 s emergidas → 1,5 s sumergidas**. Sumergidas no dan apoyo; si se sumergen con la rana encima, la rana muere.

**Nenúfares.** Llegar a una boca libre la marca como ocupada y devuelve la rana a la salida. Llegar a una boca ya ocupada es muerte. Con los cinco ocupados, la ronda se cierra.

**Cronómetro.** `15 s` en el nivel 1, `-1 s` por nivel con suelo en `8 s`. Se reinicia al empezar ronda, al ocupar un nenúfar y al perder una vida. Llegar a cero es muerte.

**Vidas.** Arranca con `3`. Cada muerte resta una y emite `onLives`. Al llegar a `0` emite `onLives(0)` y después `onGameOver(score)`, y deja de simular.

**Nivel.** El nivel es la ronda, empieza en `1` y sube al cerrar cada ronda; se emite con `onLevel`. Cada nivel multiplica todas las velocidades por **1,15** y recorta un segundo del cronómetro.

**Puntuación.**

| Hecho                                                    | Puntos                    |
| -------------------------------------------------------- | ------------------------- |
| Alcanzar por primera vez en esa vida una fila más arriba | `+10`                     |
| Ocupar un nenúfar                                        | `+50`                     |
| Bonus de tiempo al ocupar un nenúfar                     | `segundos restantes × 10` |
| Cerrar la ronda (los cinco nenúfares)                    | `+200`                    |

`onScore` se emite solo cuando el total cambia.

---

## Controles

```ts
actions: ["up", "down", "left", "right"];
controls: [
  { keys: "↑ ↓ ← →", label: "Saltar de celda" },
  { keys: "W A S D", label: "Lo mismo" },
];
```

Cada acción táctil escribe en la **misma tecla** que usaría el teclado, para que `setInput` no abra un segundo camino de input. Las flechas van en `SCROLL_KEYS` con `preventDefault`. El motor **no** escucha `P` ni `Escape`: la pausa es de la plataforma.

`DPAD_ORDER` de `game-player.tsx` ya reparte `up / left / right / down`: la cruceta sale bien sin tocar nada.

---

## Plan de implementación

1. **Constantes, tipos y paleta.** Las medidas de arriba, más los tipos locales (no exportados) `Direction`, `Lane`, `Entity`, `Frog`, y el `Record<SkinId, RanariaSkin>` con la entrada `clasico`: verde lima sobre asfalto negro y río azul oscuro, en línea con el color `green` de la ficha.

2. **`buildLanes(level)`.** Construye los once carriles (5 de carretera, 6 de río) con sus entidades precargadas, huecos garantizados y velocidades escaladas por `1.15 ** (level - 1)`. Los grupos de tortugas nacen con la fase de inmersión desfasada entre sí.

3. **Bucle.** `requestAnimationFrame` con `dt` en segundos **acotado a 0,05**, para que una pestaña en segundo plano no encadene simulación. La bandera `paused` salta el `update` pero **sigue pintando**, para que al reanudar nada se teletransporte.

4. **`update(dt)`.** En orden: avanzar entidades y reciclarlas por el borde opuesto; avanzar el ciclo de las tortugas; resolver el salto en curso o consumir la dirección pendiente; si la rana descansa en el río, arrastrarla con su apoyo; resolver muerte / nenúfar / puntuación de la celda; descontar el cronómetro; emitir los eventos cuyo valor haya cambiado.

5. **`draw()`.** Fondo por zonas (nenúfares, río, mediana, asfalto, orilla), entidades de cada carril, rana, nenúfares ocupados con su silueta, y la barra del cronómetro en la franja inferior con color verde → ámbar → rojo. **Nada de score, vidas ni nivel dentro del canvas.**

6. **Colisiones y apoyo.** `hitsVehicle(frog, lanes)` para la carretera; `getSupport(frog, lanes)` para el río, que devuelve `null` si la entidad es una tortuga sumergida; `resolveGoal(frog)` para la fila 0.

7. **`killFrog()` y `completeRound()`.** Según las reglas de arriba. `killFrog` con `lives === 0` emite `onLives(0)`, luego `onGameOver(score)`, y marca la partida como terminada: no se vuelve a emitir nada hasta un `restart`.

8. **`mount` y el `GameHandle`.** `mount` registra los listeners y arranca el bucle; `destroy` los quita y cancela el `rAF`, y es idempotente. `restart` reinicia a nivel 1, 3 vidas y 0 puntos sin desmontar el canvas. `end` emite `onGameOver` con lo acumulado. `setSkin` repinta al instante aunque la partida esté pausada o terminada.

9. **Registro.** `ranaria: () => import("./ranaria").then((m) => m.ranariaEngine)` en `lib/engines/index.ts`.

10. **Cierre.** `npm run build`, `npx tsc --noEmit` y `npm run format:check`. Actualizar `references/IMPLEMENTED_GAMES.MD`.

---

## Criterios de aceptación

### De plataforma

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/ranaria.ts` no contiene ningún `any`.
- [ ] `/juegos/ranaria/jugar` muestra un canvas jugable con los controles declarados.
- [ ] La puntuación, las vidas y el nivel del HUD coinciden en todo momento con la partida, y **no** hay HUD de score, vidas ni nivel pintado dentro del canvas.
- [ ] El canvas no muestra overlays de fin de partida ni de reinicio.
- [ ] Terminar la partida abre el modal con la puntuación real conseguida.
- [ ] `PAUSA` congela el juego por completo —entidades, salto, cronómetro y ciclo de tortugas— y `REANUDAR` continúa sin saltos.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante.
- [ ] `JUGAR DE NUEVO` reinicia desde nivel 1, 3 vidas y 0 puntos sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda bucle ni listener, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'ranaria'` y aparece en `/salon?juego=ranaria`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor.
- [ ] A 375 px de ancho el juego se ve completo, sin recortes ni scroll horizontal.
- [ ] En un dispositivo de puntero grueso aparece la cruceta con las cuatro direcciones y funciona; en escritorio no se ve.
- [ ] Las flechas no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola.
- [ ] Los juegos sin motor siguen abriendo su maqueta sin errores.
- [ ] `references/started-games/` no tiene ninguna modificación introducida por la spec.

### Del juego

- [ ] El canvas de 640 × 600 muestra las cinco zonas diferenciadas: nenúfares, río, mediana, carretera y orilla de salida.
- [ ] La rana nace centrada en la orilla de salida al empezar la partida y tras cada muerte.
- [ ] Cada pulsación mueve la rana exactamente una celda, con animación de 120 ms, y no acepta otra pulsación mientras salta.
- [ ] La rana no sale por los bordes laterales ni por debajo de la orilla de salida.
- [ ] Coches y camiones recorren sus carriles en sentidos alternos y reaparecen por el borde opuesto.
- [ ] Troncos y grupos de tortugas hacen lo mismo en los seis carriles de río.
- [ ] Las tortugas alternan 3 s emergidas y 1,5 s sumergidas, con los grupos desfasados entre sí.
- [ ] Tocar un vehículo mata.
- [ ] Caer al agua sin apoyo mata.
- [ ] Que la tortuga de debajo se sumerja mata.
- [ ] Ser arrastrada fuera del borde por un tronco mata.
- [ ] Agotar el cronómetro mata.
- [ ] Sobre un tronco o tortuga emergida, la rana se desplaza con el apoyo a su velocidad real.
- [ ] Cada muerte emite `onLives(vidas - 1)` una sola vez y reinicia el cronómetro.
- [ ] Ocupar un nenúfar libre lo marca, suma `+50` más el bonus de tiempo y devuelve la rana a la salida.
- [ ] Aterrizar en un nenúfar ya ocupado, o en la orilla entre nenúfares, mata.
- [ ] Con los cinco nenúfares ocupados suma `+200`, sube el nivel, emite `onLevel` y reconstruye los carriles con los nenúfares vacíos de nuevo.
- [ ] Las velocidades suben un 15 % por nivel y el cronómetro pierde un segundo por nivel, con suelo en 8 s.
- [ ] Avanzar a una fila más arriba de las alcanzadas en esa vida suma `+10`; volver a subirla no vuelve a sumar.
- [ ] `onScore` se emite solo cuando el total cambia.
- [ ] La barra del cronómetro se pinta en la franja inferior y cambia de verde a ámbar y a rojo conforme baja.
- [ ] Al agotar la tercera vida se emiten `onLives(0)` y después `onGameOver(score)`, el motor deja de simular y aparece el modal.

---

## Decisiones

- **Sí: motor `lib/engines/ranaria.ts`, no un componente React.** Es lo que exige el contrato de la plataforma; el reproductor genérico ya resuelve HUD, pausa, modal, guardado y controles táctiles. Este es el cambio de fondo respecto a la spec 03.
- **Sí: el `id` es `ranaria`, no `frogger`.** La ficha existe desde la SPEC 01, `.cover-rana` está en `globals.css` y `scores` puede tener filas con ese `game_id`. Renombrar obligaría a una migración a cambio de nada.
- **Sí: solo el cronómetro dentro del canvas.** El HUD de la plataforma tiene `Puntuación`, `Vidas` y `Nivel`, y ninguno más. El cronómetro no es estado de plataforma: es parte del tablero, y por eso el canvas gana una franja de 40 px al pie. El "doble HUD" que pedía la spec 03 va contra el contrato y se descarta.
- **Sí: rejilla discreta con salto de 120 ms.** Es la mecánica canónica y hace triviales la colisión y el apoyo. La variante continua es la spec rival `02-ranaria-jugable.md`, que esta spec descarta.
- **Sí: 640 × 600.** El recorrido de Frogger es vertical; `.game-canvas` escala por CSS con `object-fit: contain`, así que la resolución interna es fija y no depende de la pantalla.
- **Sí: se permite retroceder.** El jugador puede esperar en la mediana y bajar si hace falta; el cronómetro es lo que impide acampar. La variante sin retroceso es la spec rival `02`.
- **Sí: `skins: ["clasico"]` de salida.** El subagente `skin-designer` es el dueño del mecanismo de skins y añade `retro` y `neon` justo después, en el mismo flujo `/spec-impl-game`. Adelantarlas aquí duplicaría el trabajo y las paletas se decidirían dos veces.
- **No: sin sprites bitmap.** No hay assets de Frogger en el repositorio y dibujar por código evita la carga asíncrona de imágenes.
- **No: sin mosca bonus ni cocodrilo.** Son capas de dificultad y recompensa independientes de la mecánica base; caben en una spec posterior.
- **No: sin audio.** Hay una spec transversal pendiente que cubrirá los cuatro juegos a la vez.
