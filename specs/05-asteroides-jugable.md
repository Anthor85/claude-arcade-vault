# SPEC 05 — Asteroides jugable: primer juego real en la plataforma

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-08-21
> **Objetivo:** Portar el clon de Asteroids de `references/started-games/02-claude-asteroids` a un motor TypeScript montable desde React, y conectarlo al reproductor mediante un contrato `GameEngine` reutilizable, de modo que `/juegos/asteroides/jugar` sea una partida real cuya puntuación se inscribe en el Salón de la Fama.

## Por qué existe esta spec

La plataforma ya tiene cuenta, sesión, tabla `scores` con RLS y un Salón de la Fama que lee de la base de datos (SPEC 04). Lo único que falta es el juego: `components/game-player.tsx` es una simulación: un `setInterval` sube la puntuación entre 10 y 99 puntos cada 220 ms, otro resta una vida cada 7 segundos, y el "juego" es un `div.player-ship` con tres `div.enemy` animados por CSS. Se guarda en `scores` un número que nadie ha jugado.

En `references/started-games/` hay tres juegos ya escritos (Asteroids, Tetris, Arkanoid). El primero, Asteroids, encaja exactamente con la ficha `rocas` del catálogo ("Pulveriza asteroides en gravedad cero", SHOOTER, amarillo).

Ese código no se puede usar tal cual:

- `game.js` es un **script clásico** de 587 líneas: todo vive en el ámbito global del fichero, sin `import`/`export`, y las tres últimas líneas hacen `initGame()` y arrancan un `requestAnimationFrame` infinito que nadie puede parar.
- Depende de `document.getElementById('canvas')` en la línea 3, es decir, del DOM existiendo antes de que el script se evalúe.
- Pinta su propio HUD (`drawHUD`) y su propio overlay de fin de partida ("GAME OVER — ESPACIO PARA REINICIAR") dentro del canvas, ignorando el marco CRT y el HUD de la plataforma.
- No hay forma de saber desde fuera cuánto lleva marcado el jugador ni cuándo ha terminado.

Esta spec resuelve las dos cosas a la vez: porta Asteroides **y** define el contrato por el que entrarán Tetris y Arkanoid sin volver a tocar el reproductor.

> **Aviso de versión.** El montaje del canvas es código de cliente dentro de un componente que ya es `"use client"`. No se introduce ninguna API nueva de Next, pero el motor se carga con un `import()` dinámico dentro de un efecto: no se usa `next/dynamic`, que es para componentes React. Consultar `node_modules/next/dist/docs/` antes de escribir cualquier cosa que toque routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Contrato `GameEngine`** en `lib/engines/types.ts`: cómo un juego se monta sobre un `<canvas>`, qué eventos emite (puntuación, vidas, nivel, fin de partida) y qué mando a distancia devuelve (pausar, reanudar, reiniciar, terminar, input táctil, destruir).
- **Registro de motores** en `lib/engines/index.ts`, con carga diferida por `import()`: `gameId → () => Promise<GameEngine>`.
- **Port de Asteroides** a `lib/engines/asteroids.ts`: misma lógica de juego (naves, asteroides que se parten, partículas, power-ups de disparo triple y escudo, espacio toroidal, 3 vidas), encapsulada en una factoría sin estado global y sin bucle que se arranque solo.
- **Reproductor conectado**: `components/game-player.tsx` monta el canvas real cuando el juego tiene motor, alimenta el HUD existente con los eventos del motor y abre el modal de fin de partida —el mismo de la SPEC 04, con `GUARDAR PUNTUACIÓN`— cuando el motor avisa.
- **Maqueta como respaldo**: los 7 juegos sin motor siguen mostrando la simulación actual, sin cambios visibles.
- **Botones del HUD con efecto real**: `PAUSA` congela el loop, `FIN` abandona la partida y abre el modal con lo marcado hasta ese momento. Pausa automática al perder el foco de la pestaña. Teclas `P` y `Escape` para pausar.
- **Controles táctiles** superpuestos al canvas en dispositivos de puntero grueso (`pointer: coarse`), que alimentan el mismo mapa de acciones del motor.
- **Renombrado `rocas` → `asteroides`** en `lib/games.ts`, en la clase de portada de `app/globals.css` y en las filas ya guardadas de `scores`, con una migración SQL versionada.
- Ayuda de controles visible bajo el marco CRT (flechas, espacio).

**Fuera (otra spec si llega):**

- **Tetris y Arkanoid** (`references/started-games/03-claude-tetris`, `04-claude-arkanoid`). El contrato se diseña pensando en ellos, pero solo se implementa Asteroides.
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos. Siguen siendo números inventados en las 8 fichas; afecta a home, biblioteca y ficha de juego, no al reproductor.
- Retirar la simulación falsa de los otros 7 juegos o marcarlos como "próximamente".
- Sonido, música y opciones de volumen. El juego original no tiene audio.
- Guardado de partida a medias, repeticiones, tabla de récords local o modo de práctica.
- Validación anti-trampas de la puntuación. Sigue vigente el riesgo asumido en la SPEC 04: la marca la envía el cliente. Un motor real no lo arregla, solo lo hace menos cómodo de falsear.
- Canvas de resolución variable según la pantalla.
- Cambios en el juego en sí: dificultad, número de vidas, tabla de puntos, power-ups nuevos. Se porta lo que hay.
- Modificar `references/started-games/`. Es material de referencia; el port es una copia en `lib/engines/`.
- Realtime en el Salón de la Fama (pendiente desde la SPEC 04).
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

### Contrato de motor — `lib/engines/types.ts`

```ts
/** Acciones que el reproductor puede inyectar desde controles táctiles. */
export type GameAction = "left" | "right" | "thrust" | "fire";

/** Lo que el motor le cuenta al reproductor mientras se juega. */
export type GameEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  /** Última vida perdida, o botón FIN. El reproductor abre el modal. */
  onGameOver: (finalScore: number) => void;
};

/** Mando a distancia que el reproductor conserva mientras el juego vive. */
export type GameHandle = {
  pause: () => void;
  resume: () => void;
  /** Empieza una partida nueva desde cero sin desmontar el canvas. */
  restart: () => void;
  /** Termina la partida a voluntad: emite `onGameOver` con lo marcado. */
  end: () => void;
  /** Traduce un control táctil al mismo estado que una tecla mantenida. */
  setInput: (action: GameAction, down: boolean) => void;
  /** Para el loop y suelta los listeners. Idempotente. */
  destroy: () => void;
};

export type GameEngine = {
  /** Resolución interna del canvas; el reproductor la escala por CSS. */
  width: number;
  height: number;
  /** Acciones que este juego entiende: con esto se pinta el mando táctil. */
  actions: readonly GameAction[];
  /** Ayuda de teclado que se muestra bajo el marco CRT. */
  controls: readonly { keys: string; label: string }[];
  mount: (canvas: HTMLCanvasElement, events: GameEvents) => GameHandle;
};
```

**Invariantes del contrato**, que todo motor futuro debe cumplir:

- `mount` no arranca ningún trabajo antes de ser llamado: importar el módulo no tiene efectos secundarios.
- El motor **no** escribe en el DOM fuera de su `<canvas>` ni pinta HUD ni overlays de estado: eso es de la plataforma.
- Los listeners de teclado los registra `mount` y los quita `destroy`.
- Los eventos se emiten solo cuando el valor **cambia**, no en cada frame.
- Tras `onGameOver` el motor deja de simular y no vuelve a emitir hasta un `restart`.

### Registro de motores — `lib/engines/index.ts`

```ts
type EngineLoader = () => Promise<GameEngine>;

/** gameId de `lib/games.ts` → motor. Los que faltan usan la maqueta. */
const ENGINES: Record<string, EngineLoader> = {
  asteroides: () => import("./asteroids").then((m) => m.asteroidsEngine),
};

export function hasEngine(gameId: string): boolean;
export function loadEngine(gameId: string): Promise<GameEngine> | undefined;
```

Carga diferida a propósito: el motor de Asteroides no debe viajar en el bundle de `/`, `/juegos` ni del resto de juegos, y con ocho motores el problema sería ocho veces mayor.

### El motor de Asteroides — `lib/engines/asteroids.ts`

Port de `references/started-games/02-claude-asteroids/game.js`, con la misma organización por secciones (`// ── … ──`), los mismos comentarios en español y las mismas constantes de tuning en línea. Cambios estructurales, no de comportamiento:

| `game.js` (original)                                       | `lib/engines/asteroids.ts` (port)                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `const canvas = document.getElementById('canvas')`         | `canvas` es parámetro de `mount`                                               |
| `W = 800`, `H = 600` como constantes de módulo             | `width`/`height` del `GameEngine`; el motor las escribe en el canvas al montar |
| `let ship, bullets, score, lives, level, state, deadTimer` | variables locales del closure de `mount`                                       |
| Clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` | igual, pero definidas dentro del closure (o con `ctx`/`W`/`H` inyectados)      |
| `window.addEventListener('keydown', …)` global             | registrado en `mount`, retirado en `destroy`                                   |
| `drawHUD()`                                                | **eliminado**: el HUD lo pinta React                                           |
| `drawOverlay('GAME OVER', …)` y reinicio con espacio       | **eliminados**: el fin de partida es el modal de React                         |
| `initGame(); requestAnimationFrame(loop);` al final        | `mount` arranca el loop; `restart` vuelve a llamar a `initGame`                |
| `state: 'playing' \| 'dead' \| 'gameover'`                 | igual, más una bandera `paused` que salta `update` sin parar el `rAF`          |

Se conserva tal cual: el contrato de entidad (`update(dt)`, `draw()`, bandera `dead`, filtrado por `!dead`), el `dt` en segundos limitado a 0.05, el envolvimiento toroidal con `wrap()`, el input de dos niveles (`keys[code]` mantenida / `pressed(code)` flanco de subida), las tablas `RADII`/`SPEEDS`/`POINTS` indexadas por tamaño, los power-ups (`triple`, `shield`) con sus tiempos y probabilidad de caída, y las 3 vidas con invencibilidad al reaparecer.

`setInput(action, down)` escribe en el mismo mapa `keys` que el teclado (`left`→`ArrowLeft`, `right`→`ArrowRight`, `thrust`→`ArrowUp`, `fire`→`Space`), de modo que los controles táctiles no son un camino de código aparte.

### Estado del reproductor — `components/game-player.tsx`

La simulación pasa a ser una rama, no el componente entero:

```ts
type PlayerStatus = "loading" | "playing" | "paused" | "over";
```

`score`, `lives` y `level` dejan de calcularse en React y pasan a ser eco de los eventos del motor. `POINTS_PER_LEVEL`, `TICK_MS`, `LIFE_MS` y sus dos `setInterval` solo sobreviven en la rama de maqueta.

### Base de datos

No hay tablas ni columnas nuevas. Una única migración de datos, `supabase/migrations/<ts>_renombrar_rocas_a_asteroides.sql`:

```sql
update public.scores set game_id = 'asteroides' where game_id = 'rocas';
```

`game_id` sigue siendo texto libre validado solo por el catálogo de `lib/games.ts`; no hay clave foránea que actualizar ni vista que recrear (`hall_of_fame` lee `game_id` directamente).

## Plan de implementación

1. **Contrato y registro.** Crear `lib/engines/types.ts` con `GameAction`, `GameEvents`, `GameHandle` y `GameEngine`, documentando los invariantes en comentarios. Crear `lib/engines/index.ts` con `ENGINES`, `hasEngine` y `loadEngine`, de momento con el registro vacío. Prueba manual: `npx tsc --noEmit` pasa y `npm run build` sigue pasando.
2. **Port del motor.** Crear `lib/engines/asteroids.ts` copiando `references/started-games/02-claude-asteroids/game.js` y aplicando los cambios estructurales de la tabla de arriba: closure en `mount`, `canvas` por parámetro, HUD y overlay fuera, listeners retirados en `destroy`, tipos en `strict`. Exportar `asteroidsEngine: GameEngine` y registrarlo bajo la clave `asteroides`. **No tocar nada dentro de `references/`.** Prueba manual: `npx tsc --noEmit` pasa sin un solo `any`.
3. **Renombrado del juego en el catálogo.** En `lib/games.ts`, cambiar el `id` de `rocas` a `asteroides`, el `title` a `ASTEROIDES` y `cover` a `cover-asteroides`; ajustar `short`/`long` para que describan el juego real (asteroides que se parten en fragmentos, power-ups de disparo triple y escudo) y quitar la mención a los OVNIs, que no existen. Renombrar `.cover-rocas` y sus pseudoelementos a `.cover-asteroides` en `app/globals.css`. Prueba manual: `grep -rn "rocas" app components lib` no devuelve nada; `/juegos` muestra la ficha con su portada intacta y `/juegos/asteroides` responde.
4. **Migración de las marcas.** Escribir y aplicar con `apply_migration` la migración de renombrado del `game_id`. Prueba manual: `execute_sql` con `select count(*) from scores where game_id = 'rocas'` devuelve 0.
5. **Canvas en el reproductor.** En `components/game-player.tsx`, extraer la maqueta actual a un subcomponente `MockArena` y añadir `CanvasArena`, que en un efecto carga el motor con `loadEngine(game.id)`, lo monta sobre un `<canvas ref>` con los cuatro callbacks y guarda el `GameHandle` en un ref; el `cleanup` llama a `destroy()`. Mientras el `import()` está en vuelo, el marco CRT muestra `CARGANDO…`. El HUD y el modal existentes se alimentan del estado que actualizan los callbacks. Prueba manual: entrar en `/juegos/asteroides/jugar` y jugar una partida completa; la puntuación y las vidas del HUD coinciden con lo que pasa en pantalla, y salir de la ruta no deja ningún `requestAnimationFrame` vivo (comprobable porque volver a entrar no acelera el juego).
6. **Escalado y encaje en el marco CRT.** El canvas conserva 800×600 internos y se escala por CSS dentro de `.crt-screen` respetando el aspecto 4:3 (`width: 100%; height: auto; max-height`, `image-rendering: pixelated`, sin desbordar). Añadir bajo el marco la ayuda de controles que declara el motor. Prueba manual: a 1440 px, 900 px y 375 px el juego se ve completo, centrado, sin recortes ni scroll horizontal.
7. **Pausa, fin y reinicio.** Cablear `PAUSA` → `pause()`/`resume()`, `FIN` → `end()`, y `JUGAR DE NUEVO` del modal → `restart()` sin desmontar el canvas. Pausar también al perder la visibilidad de la pestaña (`visibilitychange`) y con las teclas `P` y `Escape`. Prevenir el desplazamiento de la página con flechas y espacio mientras el juego tiene el control. Prueba manual: pausar congela todo y reanudar no teletransporta las entidades; cambiar de pestaña 30 segundos y volver deja el juego pausado y en el mismo sitio; `FIN` abre el modal con la puntuación del momento; `JUGAR DE NUEVO` empieza con 3 vidas, puntuación 0 y nivel 01.
8. **Controles táctiles.** Añadir un mando superpuesto al canvas, visible solo bajo `@media (pointer: coarse)`, con un botón por cada acción que declara el motor (izquierda, derecha, propulsar, disparar). Cada botón mantiene la acción con `pointerdown`/`pointerup`/`pointercancel` llamando a `setInput`, con `touch-action: none` para que no arrastre la página y zonas táctiles de al menos 44×44 px. Prueba manual: en el emulador de móvil de las DevTools se puede rotar, propulsar y disparar; en escritorio el mando no aparece.
9. **Guardado de la marca.** Verificar que el modal de fin de partida sigue funcionando tal y como lo dejó la SPEC 04: con sesión, `GUARDAR PUNTUACIÓN` inserta la fila; sin sesión, aviso con enlace a `/acceso`. El único cambio es de dónde sale el número. Prueba manual: jugar con sesión, guardar y ver la marca en `/salon?juego=asteroides`.
10. **Repaso final.** `npm run build`, `npm run format:check` y revisión de la consola en `/juegos/asteroides/jugar` (sin errores de hidratación ni avisos de React). Comprobar que los otros 7 juegos siguen abriendo su maqueta sin cambios.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/asteroids.ts` no contiene ningún `any`.
- [ ] `/juegos/asteroides/jugar` muestra un canvas jugable: las flechas rotan y propulsan la nave, y el espacio dispara.
- [ ] Destruir un asteroide grande produce dos medianos, y un mediano dos pequeños; los puntos son 20, 50 y 100 respectivamente.
- [ ] La puntuación, las vidas y el nivel del HUD de la plataforma coinciden en todo momento con la partida, y **no** hay ningún HUD pintado dentro del canvas.
- [ ] Al vaciarse la pantalla de asteroides, el nivel del HUD sube en uno.
- [ ] El canvas **no** muestra el overlay `GAME OVER` ni el mensaje `ESPACIO PARA REINICIAR`; pulsar espacio tras perder no reinicia nada.
- [ ] Perder la tercera vida abre el modal de fin de partida con la puntuación real conseguida.
- [ ] `PAUSA` congela el juego por completo (la nave, los asteroides y las partículas dejan de moverse) y `REANUDAR` continúa desde el mismo estado, sin saltos.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante y permite guardarla.
- [ ] `JUGAR DE NUEVO` reinicia con 3 vidas, puntuación 0 y nivel 01 sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar tras una partida inserta en `scores` una fila con `game_id = 'asteroides'` y la puntuación que muestra el modal, y aparece en `/salon?juego=asteroides`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] `select count(*) from public.scores where game_id = 'rocas'` devuelve 0, y la migración correspondiente existe en `supabase/migrations/`.
- [ ] `grep -rn "rocas" app components lib` no devuelve resultados.
- [ ] Los 7 juegos restantes siguen abriendo la maqueta de siempre, sin errores en consola.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor (se carga solo al entrar en el reproductor de un juego con motor).
- [ ] A 375 px de ancho el juego se ve completo, con el aspecto 4:3 intacto y sin scroll horizontal.
- [ ] En un dispositivo de puntero grueso aparecen los controles táctiles y permiten rotar, propulsar y disparar; en escritorio no se ven.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola de `/juegos/asteroides/jugar`.
- [ ] `references/started-games/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí:** portar `game.js` a un módulo TypeScript. Es el único camino en el que el juego entra en `strict`, en ESLint y en Prettier, y en el que el HUD y el guardado se conectan de verdad.
- **No:** `<iframe>` con los ficheros en `public/`. Cero reescritura, pero el HUD y la puntuación tendrían que viajar por `postMessage`, y el juego quedaría fuera del tipado y del formateo del proyecto.
- **No:** cargar `game.js` con `next/script` sobre un `<canvas id="canvas">`. El estado global se filtraría a `window` y remontar el componente dejaría el loop anterior corriendo.
- **Sí:** definir el contrato `GameEngine` ahora, con un solo implementador. Tetris y Arkanoid ya están escritos en `references/`: diseñar la abstracción con el segundo juego significa reescribir el reproductor entero.
- **Sí:** carga diferida del motor por `import()`. Con ocho motores registrados, un import estático los metería a todos en el bundle de cualquier página que toque el registro.
- **No:** `next/dynamic`. Es para componentes React; el motor no lo es.
- **Sí:** renombrar `rocas` a `asteroides`. El usuario prefiere el nombre real del juego; la alternativa de reutilizar `rocas` en silencio dejaría el catálogo con un nombre que no corresponde a nada, y añadir una novena ficha duplicaría dos entradas casi idénticas.
- **Sí:** migración SQL que renombra el `game_id` de las filas existentes. Borrarlas descartaría marcas ya guardadas; no hacer nada las dejaría huérfanas e invisibles.
- **Sí:** HUD pintado por la plataforma. Es lo que mantiene el marco CRT coherente entre juegos; si cada motor pinta el suyo, la plataforma es un contenedor vacío.
- **Sí:** quitar `drawHUD` y `drawOverlay` del port. Duplicar la información en el canvas y en React es peor que no tenerla.
- **Sí:** modal de React como única pantalla de fin de partida. Es donde ya vive `GUARDAR PUNTUACIÓN` desde la SPEC 04.
- **Sí:** `FIN` abandona la partida y permite guardar lo marcado. Sin ese botón, la única forma de inscribir una marca sería morir tres veces.
- **Sí:** resolución interna fija de 800×600 escalada por CSS. La física, el envolvimiento toroidal y las distancias de colisión están calibradas para ese tamaño.
- **No:** canvas de resolución variable según el contenedor. Aprovecharía la pantalla, pero cambiaría el área de juego según el dispositivo —ventaja competitiva desigual en un ranking compartido— y obligaría a revisar spawn, envolvimiento y colisiones.
- **Sí:** maqueta como respaldo para los 7 juegos sin motor. La biblioteca, la home y el Salón siguen completos mientras se portan los demás.
- **No:** marcar los otros juegos como "próximamente". Más honesto, pero dejaría la plataforma con un solo juego jugable justo después de tener el primero.
- **Sí:** controles táctiles por `pointer: coarse` en lugar de por ancho de ventana. Un portátil con pantalla táctil sigue jugando con teclado; una ventana estrecha en escritorio no enseña botones inútiles.
- **Sí:** los controles táctiles escriben en el mismo mapa de teclas del motor. Un solo camino de input que probar.
- **Sí:** `best` y `plays` se quedan como están. Conectarlos a la base de datos toca home, biblioteca y ficha de juego: es una spec propia.
- **Sí:** portar el juego tal cual, sin retocar dificultad, vidas ni power-ups. Mezclar un port con un rediseño hace imposible saber qué rompió qué.
- **Sí:** `references/started-games/` es solo lectura. Es material de referencia con su propio historial de git; el port vive en `lib/engines/`.

## Riesgos

| Riesgo                                                                                                                                                              | Mitigación                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El `requestAnimationFrame` no se cancela al desmontar y, con el Fast Refresh o el Strict Mode de React, se acumulan varios loops: el juego va al doble de velocidad | `destroy()` cancela el `rAF` por su id y es idempotente; el `cleanup` del efecto lo llama siempre. El criterio de aceptación de `SALIR` comprueba exactamente ese síntoma.                                                        |
| El Strict Mode monta y desmonta el efecto dos veces en desarrollo, y el segundo montaje encuentra listeners del primero                                             | `mount` registra los listeners y `destroy` los retira con la misma referencia de función; el guardado del handle en un ref evita montar sobre un canvas ya montado.                                                               |
| El port introduce un cambio sutil de comportamiento (una constante mal copiada, un `dt` por frame en vez de por segundo) que solo se nota jugando                   | El port es mecánico y sección a sección; se juegan varios niveles completos comparando contra `index.html` del original abierto al lado.                                                                                          |
| Convertir el estado global en closure obliga a que las clases vean `ctx`, `W` y `H`: hacerlo mal genera un fichero ilegible                                         | Las clases se definen dentro del closure de `mount`, que es donde ya viven `ctx` y las dimensiones. Se conserva la organización por secciones del original para que el diff conceptual sea comparable.                            |
| La puntuación sigue viniendo del cliente: el motor real no impide que alguien llame al Server Action con el número que quiera                                       | Riesgo ya asumido explícitamente en la SPEC 04 y no reabierto aquí. Sigue siendo la primera candidata a spec de seguimiento.                                                                                                      |
| Escalar el canvas por CSS emborrona el dibujo o descuadra el ratón en pantallas de alta densidad                                                                    | El juego se dibuja con vectores y no usa el ratón. `image-rendering: pixelated` y el aspecto 4:3 fijo mantienen el resultado limpio; se verifica a 1440, 900 y 375 px.                                                            |
| Los controles táctiles se quedan "pegados" si el dedo sale del botón sin soltar y la nave rota para siempre                                                         | Cada botón escucha `pointerup`, `pointercancel` y `pointerleave`, y al pausar o terminar la partida el reproductor limpia todas las acciones con `setInput(action, false)`.                                                       |
| Renombrar `rocas` rompe un enlace guardado o una fila de `scores` que no cubra la migración                                                                         | La migración actualiza todas las filas y el `grep` verifica que no quede ninguna referencia en el código. Un enlace externo a `/juegos/rocas` cae en el `not-found` que ya existe; no hay usuarios reales que lo tengan guardado. |
| El contrato `GameEngine`, diseñado con un juego de acción continua, no encaja con Tetris (por turnos, sin vidas) ni con Arkanoid                                    | El contrato solo exige emitir los valores que el HUD ya muestra; un juego sin vidas simplemente no llama a `onLives`. Si al portar el segundo juego el contrato se queda corto, se amplía entonces, con dos casos reales delante. |

## Lo que **no** entra en esta spec

- Portar Tetris y Arkanoid.
- Conectar `best` y `plays` a la base de datos.
- Retirar o marcar como "próximamente" los 7 juegos de maqueta.
- Sonido y música.
- Validación anti-trampas de las puntuaciones.
- Cambios de diseño o dificultad en el juego portado.
- Canvas de resolución variable.
- Realtime en el Salón de la Fama.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
