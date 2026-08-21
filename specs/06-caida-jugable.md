# SPEC 06 — Caída jugable: Tetris sobre el contrato de motores

> **Estado:** Aceptado
> **Depende de:** SPEC 05
> **Fecha:** 2026-08-21
> **Objetivo:** Portar el núcleo clásico del Tetris de `references/started-games/03-claude-tetris` a un motor TypeScript montable desde React, ampliando el contrato `GameEngine` con las acciones y el HUD que un puzzle necesita, de modo que `/juegos/caida/jugar` sea una partida real.

## Por qué existe esta spec

La SPEC 05 dejó el andamiaje terminado: el contrato `GameEngine` (`lib/engines/types.ts`), el registro diferido (`lib/engines/index.ts`) y un reproductor genérico (`components/game-player.tsx`) con HUD, pausa, modal de fin de partida, guardado y mando táctil. Hoy solo hay un motor registrado, `asteroides`. La ficha `caida` de `lib/games.ts` («CAÍDA», PUZZLE, magenta) sigue cayendo en `MockArena`: un `setInterval` que sube la puntuación sola.

En `references/started-games/03-claude-tetris` hay un Tetris completo y jugado, pero no se puede usar tal cual:

- `game.js` son 1108 líneas de **script clásico** con `'use strict'`, sin `import`/`export`, con todo el estado en el ámbito del fichero (`board`, `current`, `score`, `lines`, `level`, `animId`…).
- Cachea unos **40 IDs del DOM** en el nivel superior (`document.getElementById`), así que el script falla si el `index.html` del original no está montado antes.
- La última línea es `showMenu()`: importar el módulo arranca la aplicación entera.
- Pinta fuera de su canvas casi todo: panel lateral con SCORE / LINES / LEVEL / NEXT / POWER-UP / SKIN, overlay de Game Over con formulario de récords, menú de pausa con nivel inicial y submenú de controles, y menú de selección de modo.
- Registra `document.addEventListener("keydown", …)` en el nivel superior, y ese handler incluye `P` / `Escape` para su propia pausa, que en la plataforma es de React.

Y a diferencia de Asteroides, este juego **no encaja en el contrato**: necesita bajar, rotar y soltar —acciones que `GameAction` no tiene—, tiene un canvas secundario para la pieza siguiente, y no tiene vidas, pero el HUD del reproductor pinta el campo `Vidas` con tres corazones. Esta spec porta el juego **y** hace esos tres ajustes de plataforma, que quedan disponibles para Arkanoid.

> **Aviso de versión.** No se introduce ninguna API nueva de Next: todo el trabajo es cliente dentro de `components/game-player.tsx`, que ya es `"use client"`, y un módulo nuevo en `lib/engines/`. Si algo tocase routing o data fetching, consultar antes `node_modules/next/dist/docs/`, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Motor `lib/engines/tetris.ts`** con el núcleo clásico del original: tablero 10×20, las 7 piezas, rotación horaria con wall kicks, colisión, ghost piece, soft drop, hard drop, puntuación `[0,100,300,500,800] × nivel`, nivel cada 10 líneas, aceleración de caída y fin de partida por colisión al aparecer.
- **Pieza siguiente dentro del canvas principal**: resolución interna 420×600 (tablero de 300×600 más una columna lateral de 120 px).
- **Ampliación de `GameAction`** en `lib/engines/types.ts` con `down`, `rotate` y `drop`, y sus entradas en `ACTION_FACE` de `components/game-player.tsx`.
- **Campo `Vidas` opcional en el HUD**: el contrato declara si el juego tiene vidas y el reproductor **no pinta el campo** cuando no las tiene.
- **Registro** de `caida → lib/engines/tetris.ts` en `lib/engines/index.ts`, con `import()` diferido.
- **Reutilización de la ficha `caida`** tal cual: mismo `id`, mismos textos, misma portada `.cover-tetro`. Sin migración SQL.
- Ayuda de teclado bajo el marco CRT con los cinco controles del juego.

**Fuera (otra spec si llega):**

- **Los cuatro modos de juego** del original (Normal, Tiempo, Basura, Ataque matemático). Requieren una pantalla de selección previa a la partida que el reproductor no tiene.
- **Los cinco power-ups** (bomba, rayo, tinte, gravedad, congelar). Necesitan un indicador de power-up armado que hoy no cabe en el HUD.
- **Las cuatro skins** (Retro, Neón, Pastel, Pixel art) y su preferencia en `localStorage`. Se porta solo la paleta `retro`.
- **Nivel inicial configurable** (`tetris-start-level`) y su selector. La partida empieza siempre en el nivel 1.
- **Tabla de récords local** (`tetris-records`) y su formulario. El ranking de la plataforma es `scores` y el Salón de la Fama.
- **Tema claro/oscuro propio** del juego. El marco CRT de la plataforma es oscuro y único.
- **Contador de LÍNEAS visible.** El HUD tiene tres campos y ninguno lo admite; ver «Decisiones».
- **Repetición automática al mantener** un botón táctil (DAS/ARR). Cada pulsación mueve una celda, igual que cada pulsación de tecla en el original.
- Audio, música y volumen: el original no tiene.
- Arkanoid (`references/started-games/04-claude-arkanoid`).
- Validación anti-trampas de la puntuación: sigue viniendo del cliente, riesgo asumido desde la SPEC 04.
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos.
- Modificar `references/started-games/`: es material de referencia de solo lectura.
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

### Base de datos

**No hay nada.** No se crean tablas ni columnas, y **no hace falta migración**: la ficha conserva el `id` `caida`, así que las filas ya guardadas en `scores` con `game_id = 'caida'` siguen siendo válidas y visibles en `/salon?juego=caida`.

### Cambios en el contrato — `lib/engines/types.ts`

Dos cambios, ambos aditivos:

```ts
export type GameAction =
  | "left"
  | "right"
  | "thrust"
  | "fire"
  /** Bajar una fila (soft drop). */
  | "down"
  /** Girar la pieza. */
  | "rotate"
  /** Soltar de golpe (hard drop). */
  | "drop";

export type GameEngine = {
  // …
  /** `false` en juegos sin vidas: el reproductor oculta ese campo del HUD. */
  hasLives: boolean;
};
```

`hasLives` es obligatorio, no opcional: obliga a cada motor a decidirlo. `lib/engines/asteroids.ts` declara `hasLives: true` y no cambia en nada más.

### Cambios en el reproductor — `components/game-player.tsx`

| Punto              | Cambio                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACTION_FACE`      | Tres entradas nuevas: `down` (`▼`, «Bajar»), `rotate` (`⟳`, «Rotar»), `drop` (`⤓`, «Caída instantánea»)                                                    |
| `STEERING`         | Pasa a `["left", "right", "down"]`: la columna direccional del mando agrupa las tres, y `rotate` y `drop` caen en el grupo de acción                       |
| `EngineMeta`       | Lleva también `hasLives`, que sale del motor en `onReady`                                                                                                  |
| HUD, campo `Vidas` | Se pinta solo si el juego tiene vidas: en la rama de maqueta siempre, y con motor cuando `meta.hasLives`. Mientras el `import()` está en vuelo no se pinta |

Nada más del reproductor cambia: `MockArena`, la pausa por `P` / `Escape` / `visibilitychange`, el modal de fin de partida, `saveScore` y el aviso para invitados funcionan igual.

### El motor — `lib/engines/tetris.ts`

Port de `references/started-games/03-claude-tetris/game.js` aplicando el patrón ya validado en `lib/engines/asteroids.ts`:

| `game.js` (original)                                           | `lib/engines/tetris.ts` (port)                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `document.getElementById("board")` y ~40 IDs más               | `canvas` es parámetro de `mount`; el resto de IDs desaparece                   |
| `<canvas id="next-canvas">` 120×120 aparte                     | Columna lateral del canvas principal, `x` de 300 a 420                         |
| `COLS`, `ROWS`, `BLOCK` de módulo                              | Constantes del módulo; `width = COLS * BLOCK + PANEL`, `height = ROWS * BLOCK` |
| `let board, current, next, score, lines, level, …` globales    | Variables locales del closure de `mount`                                       |
| `document.addEventListener("keydown", …)` en el nivel superior | Registrado en `mount`, retirado en `destroy`                                   |
| `P` / `Escape` dentro del handler de teclado                   | **Eliminados**: la pausa es de la plataforma                                   |
| `updateHUD()` sobre `scoreEl` / `linesEl` / `levelEl`          | **Eliminado**: emite `onScore` y `onLevel` solo cuando el valor cambia         |
| `overlay`, `pause-menu`, `menu`, formulario de récords         | **Eliminados**: el fin de partida es el modal de React                         |
| `SKINS`, `applySkin`, `localStorage`                           | **Eliminados**: se conserva solo la paleta `COLORS` (retro)                    |
| `MODES`, power-ups, basura, piezas `+`, combo, nivel inicial   | **Eliminados**: fuera de alcance                                               |
| `endGame()` con overlay                                        | `events.onGameOver(score)`; el motor deja de simular                           |
| `startGame()` / `showMenu()` al final del script               | `mount` arranca el loop; `restart()` vuelve a llamar a `init()`                |
| `pause()` hace `cancelAnimationFrame`                          | Bandera `paused` que salta el `update` sin parar el `rAF`                      |

Se conserva sin tocar: la matriz `ROWS × COLS` con `0` = vacío y `1–7` = índice en `COLORS`/`PIECES`, `collide` como única primitiva de validación, `rotateCW` (transposición + reverso), `tryRotate` con los desplazamientos `[0,-1,1,-2,2]`, el acumulador `dropAccum` contra `dropInterval`, `dropIntervalFor(lv) = max(100, 1000 − (lv−1) × 90)`, `LINE_SCORES = [0,100,300,500,800]` multiplicado por el nivel, +1 punto por fila de soft drop y +2 por celda de hard drop, el nivel `1 + floor(lines / 10)`, la ghost piece con `globalAlpha = 0.2` y la detección de fin de partida en `spawn()`.

**Declaración del motor:**

```ts
export const tetrisEngine: GameEngine = {
  width: 420, // 300 de tablero + 120 de columna lateral
  height: 600,
  hasLives: false,
  actions: ["left", "right", "down", "rotate", "drop"],
  controls: [/* ←→ mover · ↓ bajar · ↑/X rotar · Espacio soltar */],
  mount(canvas, events) {
    /* … */
  },
};
```

`ACTION_KEYS` traduce cada acción táctil a la **misma tecla** que usaría el teclado (`left`→`ArrowLeft`, `right`→`ArrowRight`, `down`→`ArrowDown`, `rotate`→`ArrowUp`, `drop`→`Space`), así que `setInput` no abre un segundo camino de input. Las cinco acciones son de flanco: se ejecutan en el `down === true` y el `false` solo limpia el estado.

## Plan de implementación

1. **Ampliar el contrato.** En `lib/engines/types.ts`, añadir `down`, `rotate` y `drop` a `GameAction` y el campo `hasLives: boolean` a `GameEngine`. En `lib/engines/asteroids.ts`, declarar `hasLives: true`. Prueba manual: `npx tsc --noEmit` pasa y `/juegos/asteroides/jugar` sigue jugándose igual.
2. **HUD sin vidas.** En `components/game-player.tsx`, llevar `hasLives` a `EngineMeta` y condicionar el bloque `.hud-stat.lives` a que el juego tenga vidas. Prueba manual: en `/juegos/asteroides/jugar` el campo `Vidas` sigue apareciendo con tres corazones; el HUD no se descuadra cuando falta un campo (a 375 px tampoco).
3. **Mando táctil con las acciones nuevas.** En `components/game-player.tsx`, añadir las tres entradas de `ACTION_FACE` y pasar `STEERING` a `["left", "right", "down"]`. Prueba manual: en el emulador de móvil, el mando de Asteroides no cambia.
4. **Port del núcleo.** Crear `lib/engines/tetris.ts` con los cambios estructurales de la tabla de arriba, sin modos, power-ups, skins ni récords, y exportar `tetrisEngine: GameEngine`. **No tocar nada dentro de `references/`.** Prueba manual: `npx tsc --noEmit` pasa sin un solo `any`.
5. **Columna lateral con la pieza siguiente.** Dibujar el tablero en `x ∈ [0, 300)` y la pieza siguiente centrada en una rejilla de 4×4 celdas dentro de `x ∈ [300, 420)`, con el mismo `drawBlock` parametrizado por contexto y tamaño que ya usa el original. Prueba manual: la pieza previsualizada coincide siempre con la que aparece a continuación.
6. **Registro del motor.** Añadir `caida: () => import("./tetris").then((m) => m.tetrisEngine)` a `ENGINES` en `lib/engines/index.ts`. Prueba manual: `/juegos/caida/jugar` monta el canvas real en vez de la maqueta; el bundle de `/` y `/juegos` no incluye el motor.
7. **Partida completa.** Jugar de principio a fin comparando con el original abierto al lado. Prueba manual: las líneas puntúan 100 / 300 / 500 / 800 por el nivel, el nivel sube cada 10 líneas y la caída se acelera, el hard drop suma 2 por celda y el soft drop 1 por fila, y la partida termina cuando una pieza nueva no cabe.
8. **Pausa, fin y reinicio.** Verificar `PAUSA`, `FIN`, `JUGAR DE NUEVO` y `SALIR` contra el motor nuevo, y que las flechas y el espacio no desplazan la página. Prueba manual: pausar congela la caída y reanudar no la teletransporta; volver a entrar en la ruta arranca una partida limpia a velocidad normal.
9. **Repaso final.** `npm run build`, `npm run format:check` y consola limpia en `/juegos/caida/jugar`. Comprobar que los 6 juegos sin motor siguen abriendo su maqueta.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/tetris.ts` no contiene ningún `any`.
- [ ] `/juegos/caida/jugar` muestra un canvas jugable: `←` / `→` mueven, `↓` baja, `↑` o `X` rotan y `Espacio` suelta la pieza.
- [ ] Rotar una pieza pegada a la pared la desplaza en vez de rechazar el giro (wall kicks).
- [ ] La ghost piece marca dónde va a aterrizar la pieza actual.
- [ ] La columna lateral del canvas muestra la pieza siguiente, y esa es exactamente la que aparece después.
- [ ] Limpiar 1, 2, 3 o 4 líneas suma 100, 300, 500 u 800 puntos multiplicados por el nivel.
- [ ] El nivel del HUD sube cada 10 líneas y la caída se acelera visiblemente.
- [ ] El HUD de `/juegos/caida/jugar` **no** muestra el campo `Vidas`; el de `/juegos/asteroides/jugar` sí, con sus tres corazones.
- [ ] La puntuación y el nivel del HUD coinciden en todo momento con la partida, y **no** hay ningún HUD pintado dentro del canvas.
- [ ] El canvas no muestra overlays de pausa, de fin de partida ni menú de modos, y no aparece ningún panel lateral en DOM.
- [ ] Que una pieza nueva no quepa al aparecer abre el modal con la puntuación real conseguida.
- [ ] `PAUSA` congela la caída por completo y `REANUDAR` continúa sin que la pieza salte de fila.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante.
- [ ] `JUGAR DE NUEVO` reinicia con tablero vacío, puntuación 0 y nivel 01, sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'caida'` y aparece en `/salon?juego=caida`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor.
- [ ] A 375 px de ancho el juego se ve completo, con la columna lateral incluida, sin recortes ni scroll horizontal.
- [ ] En un dispositivo de puntero grueso aparecen cinco botones táctiles —mover, bajar, rotar y soltar— y todos funcionan; en escritorio no se ven.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola.
- [ ] Los juegos sin motor siguen abriendo su maqueta sin errores, y `/juegos/asteroides/jugar` se juega igual que antes.
- [ ] `references/started-games/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí:** ampliar `GameAction` con `down`, `rotate` y `drop`. Es el cambio más honesto: cada acción del juego se llama como lo que hace, y el glifo del mando táctil no miente.
- **No:** reutilizar `thrust` para rotar y `fire` para soltar. No habría hecho falta tocar el contrato, pero un mando de puzzle con `▲` para girar y `●` para soltar es incomprensible, y el soft drop se quedaba sin hueco.
- **No:** ampliar solo con `down` y `rotate`, dejando el hard drop en `fire`. Media medida: el contrato queda más pequeño pero `fire` sigue significando otra cosa.
- **Sí:** pintar la pieza siguiente dentro del canvas principal, ampliando la resolución interna a 420×600. `.game-canvas` usa `object-fit: contain`, así que un canvas más ancho que 4:3 encaja con bandas sin deformarse, y el reproductor no se entera.
- **No:** añadir un canvas auxiliar al contrato. Es el cambio más invasivo en plataforma y solo lo usaría este juego.
- **No:** quitar la vista previa. Planificar la siguiente pieza es una mecánica real del Tetris, no un adorno.
- **Sí:** declarar `hasLives` y ocultar el campo del HUD. Un campo `Vidas` con un guion durante toda la partida es ruido, y tres corazones que nunca bajan serían mentira.
- **No:** reutilizar el campo `Vidas` como cuenta atrás de líneas para el siguiente nivel. La etiqueta seguiría diciendo `Vidas`.
- **No (por ahora):** un tercer campo de HUD con rótulo por motor. Resolvería también el contador de LÍNEAS, pero es un rediseño del HUD genérico y esta spec ya toca el contrato dos veces. Si Arkanoid vuelve a pedirlo, se hace entonces con dos casos delante.
- **Sí:** portar solo el núcleo clásico. Modos, power-ups y skins son una capa entera de UI fuera del canvas —menú de selección, indicador de power-up, selector de tema— que la plataforma no tiene; meterlos mezclaría el port con un rediseño del reproductor.
- **Sí:** reutilizar la ficha `caida` tal cual. El título, la descripción («Encaja las piezas antes de que el techo te aplaste», «la velocidad aumenta sin piedad cada 10 líneas») y la portada `.cover-tetro` ya describen exactamente este juego.
- **No:** renombrar el `id` a `tetris`. Sería más reconocible, pero obligaría a una migración de `scores` como la de `rocas → asteroides` a cambio de nada que el jugador note.
- **No:** ficha nueva junto a `caida`. Dejaría dos entradas casi idénticas de puzzle de caída de piezas en el catálogo.
- **Sí:** la pausa la sigue llevando la plataforma. El original captura `P` y `Escape` en su propio handler; si el motor los conservara, habría dos pausas peleándose.
- **Sí:** acciones de flanco, sin repetición automática al mantener el botón táctil. Es lo que hace el original, donde la repetición la pone el navegador al mantener la tecla.
- **Sí:** una sola paleta (`retro`). Las skins viven en `localStorage` y necesitan un selector fuera del canvas, que el motor no puede pintar.
- **Sí:** `references/started-games/` es de solo lectura. El port es una copia en `lib/engines/`.

## Riesgos

| Riesgo                                                                                                                      | Mitigación                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recortar modos, power-ups y skins de un fichero de 1108 líneas deja restos: constantes muertas, ramas que nunca se ejecutan | El port se escribe desde el núcleo hacia fuera, no borrando del original. Todo lo que no aparezca en la tabla de «se conserva» simplemente no se copia.          |
| El canvas de 420×600 es más estrecho que 4:3 y se ve diminuto en pantallas anchas                                           | `object-fit: contain` lo escala a la altura del marco CRT con bandas laterales. Se verifica a 1440, 900 y 375 px como criterio de aceptación.                    |
| Ocultar el campo `Vidas` descuadra la fila del HUD, que hoy asume cuatro campos                                             | La fila es un `flex` con `gap` y `flexWrap`: quitar un hijo la reordena sola. Se comprueba en los dos juegos y a 375 px.                                         |
| Ampliar `GameAction` obliga a `ACTION_FACE` a cubrir siete acciones; olvidar una rompe el tipo en compilación               | `ACTION_FACE` es un `Record<GameAction, …>`: si falta una entrada, `npx tsc --noEmit` falla antes de llegar al navegador.                                        |
| Sin contador de LÍNEAS visible, el jugador no sabe cuánto le falta para subir de nivel                                      | El nivel del HUD sí se ve y sube cada 10 líneas. Queda anotado en «Fuera» como candidato a un tercer campo de HUD con rótulo por motor.                          |
| La pausa por bandera cambia el comportamiento del original, que cancela el `rAF` y resetea `lastTime`                       | La bandera salta el `update` pero el `rAF` sigue vivo, así que `dt` nunca acumula el tiempo de la pausa: es el patrón ya validado en Asteroides.                 |
| El Strict Mode monta y desmonta el efecto dos veces en desarrollo y se acumulan dos loops: la pieza cae al doble            | `destroy()` cancela el `rAF` por su id, retira los listeners con la misma referencia y es idempotente; el criterio de `SALIR` comprueba exactamente ese síntoma. |
| Un hard drop con la página desplazable mueve la vista en vez de soltar la pieza                                             | El motor hace `preventDefault` sobre `Space` y las flechas mientras el juego tiene el control, igual que Asteroides.                                             |
| La puntuación sigue viniendo del cliente                                                                                    | Riesgo asumido desde la SPEC 04 y no reabierto aquí.                                                                                                             |

## Lo que **no** entra en esta spec

- Los cuatro modos de juego, los cinco power-ups y las cuatro skins del original.
- Nivel inicial configurable y tabla de récords local.
- Contador de LÍNEAS en el HUD y el tercer campo con rótulo por motor.
- Repetición automática al mantener un botón táctil.
- Portar Arkanoid.
- Conectar `best` y `plays` a la base de datos.
- Retirar o marcar como «próximamente» los juegos que siguen en maqueta.
- Sonido y música.
- Validación anti-trampas de las puntuaciones.
- Realtime en el Salón de la Fama.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
