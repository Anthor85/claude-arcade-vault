# SPEC 07 — Arkanoid jugable: el tercer motor de la plataforma

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-08-23
> **Objetivo:** Portar el Arkanoid de `references/started-games/04-claude-arkanoid` a un motor TypeScript que cumpla el contrato `GameEngine`, y darle ficha propia en el catálogo, de modo que `/juegos/arkanoid/jugar` sea una partida real de cinco niveles cuya puntuación se inscribe en el Salón de la Fama.

## Por qué existe esta spec

La plataforma ya sabe montar juegos: la SPEC 05 dejó el contrato `GameEngine` (`lib/engines/types.ts`), el registro diferido (`lib/engines/index.ts`) y el reproductor genérico (`components/game-player.tsx`) con HUD, pausa, modal de fin de partida, guardado y mando táctil. La SPEC 06 lo confirmó portando Tetris y ampliando `GameAction` con `down`, `rotate` y `drop`. Hoy hay dos motores registrados —`asteroides` y `caida`— y los otros seis juegos del catálogo siguen abriendo la maqueta.

Arkanoid es el tercer juego de `references/started-games/` y el último que quedaba escrito. Es también el primero que trae **assets de imagen**: todo lo que se ve —bloques, paddle, bola, explosiones— sale de `assets/spritesheet-breakout.png`.

Ese código no se puede usar tal cual:

- `game.js` son 810 líneas de script clásico con `"use strict"`, sin `import`/`export`. Todo el estado (`bricks`, `paddle`, `balls`, `powerups`, `level`, `score`, `lives`, `animId`…) vive en el ámbito del fichero.
- Las líneas 4 a 13 cachean trece nodos del DOM con `getElementById`: el canvas, cinco campos de HUD, el overlay, el botón Reiniciar y los controles de audio. El script no se puede evaluar sin ese `index.html` concreto.
- Pinta su HUD en el DOM (`updateHUD`, `drawLives` genera un `<canvas>` de 16 px por vida) y sus estados en un overlay HTML (`showOverlay` con PAUSA, GAME OVER, ¡VICTORIA! y ¡NIVEL COMPLETADO!). La plataforma ya tiene ambas cosas.
- Registra listeners en `document` y en el `canvas` al cargarse, y arranca solo: `loadSpritesheet(() => { init(); requestAnimationFrame(loop); })` en las últimas líneas.
- El bucle **se detiene solo** en pausa, game over, victoria y nivel completado, y se relanza con `resumeLoop()`. El contrato de la plataforma espera lo contrario: un `rAF` vivo con una bandera `paused` que salta el `update`.
- `assets/spritesheet.js` declara `SPRITES`, `EXPLOSION_FRAMES`, `loadSpritesheet`, `drawSprite` y `drawFrame` como globales, y carga el PNG por una ruta relativa (`assets/spritesheet-breakout.png`) que en Next no existe.
- No hay forma de saber desde fuera cuánto lleva marcado el jugador ni cuándo ha terminado.

> **Aviso de versión.** No se introduce ninguna API nueva de Next: el motor se carga con un `import()` dinámico dentro de un efecto de un componente que ya es `"use client"`, exactamente como en la SPEC 05. Lo único nuevo es un archivo estático en `public/`. Consultar `node_modules/next/dist/docs/` antes de escribir cualquier cosa que toque routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Port de Arkanoid** a `lib/engines/arkanoid.ts`: misma lógica (5 niveles, 3 vidas, bloques grises de dos golpes, aceleración por bloques rotos, cinco power-ups, multibola, láser), encapsulada en una factoría sin estado global y sin bucle que se arranque solo.
- **Port del spritesheet** a `lib/engines/arkanoid-sprites.ts`: las tablas `SPRITES` y `EXPLOSION_FRAMES` como constantes tipadas, y un cargador perezoso de la imagen que **no** se dispara al importar el módulo.
- **Asset estático**: `public/games/arkanoid/spritesheet-breakout.png`, copia byte a byte del original (30 KB).
- **Registro** de `arkanoid` en `ENGINES` (`lib/engines/index.ts`), con `import()` diferido.
- **Ficha nueva** en `lib/games.ts` (`id: "arkanoid"`, ARCADE, verde) y su portada `.cover-arkanoid` en `app/globals.css`. La ficha `bloque-buster` se queda **exactamente como está**, con su maqueta y sus tres marcas.
- **Control con ratón** sobre el canvas, traduciendo las coordenadas del puntero al espacio interno de 800×600 a través del escalado de `object-fit: contain`.
- **Continuación automática de nivel**: despejar la rejilla suma la vida extra, emite `onLevel` y carga el nivel siguiente con la bola pegada al paddle, sin overlay ni espera.
- **Victoria** al despejar el nivel 5: `onGameOver` con la puntuación conseguida, que abre el modal de siempre.
- Ayuda de controles bajo el marco CRT y mando táctil con las tres acciones del juego.

**Fuera (otra spec si llega):**

- **Audio.** El original tiene rebote, rotura, pool de 8 elementos `Audio`, botón de mute, slider de volumen y preferencias en `localStorage`. Ni Asteroides ni Tetris tienen sonido en la plataforma, y el HUD del reproductor no tiene dónde poner esos dos controles. Una spec de audio transversal a los tres motores es lo que corresponde, no un caso especial aquí.
- **El truco `LEVEL`.** Se elimina del port: es un salto de nivel gratis en un juego que ahora puntúa en un ranking compartido.
- **Retocar el juego**: dificultad, número de niveles, tabla de puntos, probabilidades de los power-ups. Se porta lo que hay.
- Retirar la maqueta de los seis juegos restantes o marcarlos como "próximamente".
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos. La ficha nueva entra con números inventados, como las otras ocho.
- Validación anti-trampas de la puntuación. Sigue vigente el riesgo asumido en la SPEC 04.
- Canvas de resolución variable según la pantalla.
- Modificar `references/started-games/`. Es material de referencia; el port es una copia.
- Realtime en el Salón de la Fama.
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

### Base de datos

**No hay ninguna migración.** `arkanoid` es un `game_id` nuevo, sin filas previas que renombrar; `bloque-buster` conserva sus tres marcas y su ficha. `game_id` sigue siendo texto libre validado solo por el catálogo de `lib/games.ts`.

### Contrato

**No cambia.** Las tres acciones de Arkanoid se cubren con valores que ya existen en `GameAction`:

| Original               | Port                                                      |
| ---------------------- | --------------------------------------------------------- |
| `ArrowLeft` / `←`      | `left`                                                    |
| `ArrowRight` / `→`     | `right`                                                   |
| `Space` / clic (sacar) | `fire`, que ya mapea a `Space` en el resto de los motores |

Por tanto `lib/engines/types.ts`, `ACTION_FACE` y `STEERING` de `components/game-player.tsx` y `components/player.module.css` **no se tocan**. El glifo táctil del saque será el `●` que ya usa `fire`.

Metadatos del motor:

```ts
width: 800,
height: 600,
hasLives: true,
actions: ["left", "right", "fire"],
```

### El motor — `lib/engines/arkanoid.ts`

Port de `references/started-games/04-claude-arkanoid/game.js`, conservando la organización por secciones (`// ---- … ----`) y los comentarios en español. Cambios estructurales, no de comportamiento:

| `game.js` (original)                                               | `lib/engines/arkanoid.ts` (port)                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `document.getElementById("board")` y otros doce nodos              | `canvas` es parámetro de `mount`; los demás nodos desaparecen                      |
| `W = 800`, `H = 600` como constantes de módulo                     | `width`/`height` del `GameEngine`; el motor los escribe en el canvas al montar     |
| `bricks`, `paddle`, `balls`, `powerups`, `level`, `score`, `lives` | variables locales del closure de `mount`                                           |
| `keys`, `lastTime`, `animId`                                       | igual, dentro del closure                                                          |
| `document.addEventListener("keydown"/"keyup", …)` al cargar        | registrados en `mount`, retirados en `destroy`                                     |
| `canvas.addEventListener("mousemove"/"mousedown", …)` al cargar    | igual, sobre el canvas de `mount`, con la conversión de escala                     |
| `updateHUD()` y `drawLives()`                                      | **eliminados**: se sustituyen por `onScore`, `onLives` y `onLevel`                 |
| `showOverlay()` / `hideOverlay()` y el estado `levelClear`         | **eliminados**: pausa y fin de partida son de la plataforma                        |
| `winGame()` con overlay de victoria                                | `onGameOver(score)`                                                                |
| `loseLife()` con `lives === 0` y overlay                           | `onLives(lives)`, y `onGameOver(score)` al llegar a 0                              |
| `togglePause()` que cancela el `animId`                            | bandera `paused` que salta el `update`; el `rAF` sigue vivo                        |
| `resumeLoop()`                                                     | **eliminado**: el bucle no se para nunca hasta `destroy`                           |
| El bucle se detiene tras game over / victoria                      | tras `onGameOver` el motor deja de simular pero no vuelve a emitir hasta `restart` |
| `restart()` (botón del HUD)                                        | `restart()` del `GameHandle`; el botón desaparece                                  |
| `cheatBuf`, `CHEAT_CODE`, `cheatSkipLevel()`                       | **eliminados**                                                                     |
| Audio: `SOUNDS`, `loadSounds`, `playSound`, volumen, mute          | **eliminados** por completo, junto con el `localStorage`                           |
| `loadSpritesheet(() => { init(); rAF(loop) })` al final            | `mount` pide los sprites y arranca el bucle; se pinta en negro hasta que carguen   |

Se conserva tal cual: la geometría (`COLS`/`ROWS`/`BRICK_W`/`GRID_X` con `GRID_X * 2 + COLS * BRICK_W === W`), las cinco matrices de `LEVELS` con `CHAR_COLORS`, la tabla `SCORES`, los dos golpes de los grises, `currentSpeed()`/`applySpeed()` con su escalón de 20 px/s cada 10 bloques y su tope de 520, `hitPaddle()` con el ángulo derivado del offset y acotado por `MAX_BOUNCE_ANGLE`, `hitBricks()` reflejando solo el eje de menor solape y saliendo al primer impacto, el caso especial del láser, `POWERUPS`/`POWERUP_ORDER` con su tirada única y excluyente, `clearPowerupEffects()` antes de cada `applyPowerup()`, la multibola a ±30º, el `dt` en segundos acotado a `MAX_DT`, y las 3 vidas que solo bajan cuando cae la **última** bola.

**Progresión de nivel.** `completeLevel()` deja de existir como estado de espera: al vaciarse la rejilla, el motor suma la vida extra (`onLives`), llama a `loadLevel(level + 1)` y emite `onLevel`. En el nivel 5 no hay siguiente, así que emite `onGameOver(score)`. El jugador saca la bola nueva cuando quiere, igual que después de perder una vida.

**Input.** `setInput(action, down)` escribe en el mismo mapa `keys` que el teclado (`left`→`ArrowLeft`, `right`→`ArrowRight`, `fire`→`Space`), como en los otros dos motores. Las teclas de desplazamiento (flechas y espacio) llevan `preventDefault`. `P` y `Escape` **no** las gestiona el motor: la pausa ya es del reproductor.

**Ratón.** El canvas se dibuja a 800×600 internos y se muestra a otro tamaño. La conversión usa `getBoundingClientRect()` y la escala real del `object-fit: contain`:

```ts
const scale = Math.min(rect.width / W, rect.height / H);
const inner = (e.clientX - rect.left - (rect.width - W * scale) / 2) / scale;
```

`mousedown` sobre el canvas saca la bola, igual que `Space`.

### Los sprites — `lib/engines/arkanoid-sprites.ts`

Port de `references/started-games/04-claude-arkanoid/assets/spritesheet.js`:

- `SPRITES` y `EXPLOSION_FRAMES` pasan a constantes exportadas y tipadas (`{ sx, sy, sw, sh }`), con `EXPLOSION_DURATION = 150`.
- `loadSpritesheet(): Promise<CanvasImageSource>` sustituye al callback. Guarda la promesa en un módulo-nivel para que dos montajes seguidos no descarguen el PNG dos veces, pero **no se ejecuta al importar**: la primera llamada es la que dispara la descarga.
- La ruta pasa a ser absoluta desde la raíz del sitio: `/games/arkanoid/spritesheet-breakout.png`.
- Se conserva el paso por un `<canvas>` intermedio del original (`drawImage` sobre un canvas del tamaño de la imagen), que es lo que evita el reescalado suave en cada `drawImage` posterior.
- `drawSprite` y `drawFrame` reciben la imagen ya cargada como parámetro en vez de leer una variable global.

Si la imagen falla, la promesa se resuelve igualmente y el juego sigue simulando sobre un fondo negro: un asset roto no debe tirar el reproductor.

### Estado del reproductor

`components/game-player.tsx` **no cambia**. `hasLives: true` hace que el HUD muestre el campo `Vidas`, y las tres acciones declaradas se reparten solas entre `STEERING` (`left`, `right`) y el bloque de acción (`fire`).

## Plan de implementación

1. **Asset y sprites.** Copiar `assets/spritesheet-breakout.png` a `public/games/arkanoid/spritesheet-breakout.png` sin modificarlo. Crear `lib/engines/arkanoid-sprites.ts` con `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet`, `drawSprite` y `drawFrame`, tipados y sin efectos al importar. Prueba manual: con `npm run dev`, abrir `http://localhost:3000/games/arkanoid/spritesheet-breakout.png` y ver la lámina; `npx tsc --noEmit` pasa.
2. **Port del motor.** Crear `lib/engines/arkanoid.ts` aplicando los cambios estructurales de la tabla de arriba: closure en `mount`, `canvas` por parámetro, HUD y overlays fuera, audio y truco fuera, bandera `paused` en vez de parar el bucle, listeners retirados en `destroy`, tipos en `strict`. Exportar `arkanoidEngine: GameEngine`. **No tocar nada dentro de `references/`.** Prueba manual: `npx tsc --noEmit` pasa sin un solo `any`.
3. **Registro.** Añadir `arkanoid: () => import("./arkanoid").then((m) => m.arkanoidEngine)` a `ENGINES` en `lib/engines/index.ts`. Prueba manual: `npm run build` pasa y el chunk del motor aparece como carga diferida.
4. **Ficha del catálogo.** Añadir a `GAMES` en `lib/games.ts` la entrada `arkanoid` (`title: "ARKANOID"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-arkanoid"`) con `short` y `long` que describan el juego real: paddle, cinco niveles, bloques grises de dos golpes y cápsulas de power-up. Añadir `.cover-arkanoid` y sus pseudoelementos a `app/globals.css`, con una imagen de filas de bloques y paddle distinguible de `.cover-bricks`. Prueba manual: `/juegos` muestra nueve fichas, la nueva con su portada, y el filtro ARCADE la incluye; `/juegos/arkanoid` responde.
5. **Canvas jugable.** Sin tocar `components/game-player.tsx`, comprobar que `/juegos/arkanoid/jugar` monta el canvas real. Prueba manual: jugar el nivel 1 entero; los bloques se rompen con su explosión, la puntuación y las vidas del HUD coinciden con la partida, y no hay ningún HUD ni overlay dentro del canvas.
6. **Ratón y saque.** Cablear `mousemove` y `mousedown` sobre el canvas con la conversión de escala. Prueba manual: a 1440 px y a 900 px de ancho de ventana, el centro del paddle queda exactamente bajo el cursor en los dos extremos del canvas y en el centro; hacer clic saca la bola.
7. **Progresión y victoria.** Despejar el nivel 1 debe sumar una vida, subir el nivel del HUD y montar la rejilla del 2 con la bola pegada, sin cartel ni espera. Despejar el 5 debe abrir el modal de fin de partida. Prueba manual: verificar los dos casos, el segundo con el nivel 5 alcanzado por el power-up `P` o jugando.
8. **Pausa, fin y reinicio.** Verificar el cableado genérico del reproductor: `PAUSA` congela bolas, cápsulas y explosiones; `FIN` abre el modal con lo marcado; `JUGAR DE NUEVO` vuelve al nivel 1 con 3 vidas y puntuación 0; cambiar de pestaña deja la partida pausada. Prueba manual: los cuatro casos seguidos en una sola sesión.
9. **Controles táctiles.** Comprobar que el mando pinta `◀`, `▶` y `●` y que los tres funcionan. Prueba manual: en el emulador de móvil de las DevTools se mueve el paddle y se saca la bola; en escritorio el mando no aparece.
10. **Guardado de la marca.** Prueba manual: jugar con sesión, guardar desde el modal y ver la marca en `/salon?juego=arkanoid`.
11. **Repaso final.** `npm run build`, `npm run format:check` y revisión de la consola en `/juegos/arkanoid/jugar` (sin errores de hidratación ni avisos de React). Comprobar que `bloque-buster`, `asteroides` y `caida` siguen igual.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y ni `lib/engines/arkanoid.ts` ni `lib/engines/arkanoid-sprites.ts` contienen ningún `any`.
- [ ] `/juegos/arkanoid/jugar` muestra un canvas jugable: `←` y `→` mueven el paddle, el ratón también, y el espacio o el clic sacan la bola.
- [ ] Los bloques, el paddle, la bola y las explosiones se dibujan con los sprites del PNG, no con primitivas.
- [ ] Un bloque gris aguanta dos golpes y solo puntúa al romperse; los puntos son 100 gris, 70 rojo, 60 rosa, 50 magenta, 40 amarillo, 30 verde y 20 cian.
- [ ] Cada 10 bloques rotos la bola acelera 20 px/s, con tope en 520 px/s, y la velocidad vuelve a la base al cambiar de nivel.
- [ ] El ángulo de rebote depende del punto de impacto en el paddle y no supera los 60º desde la vertical.
- [ ] Con multibola en juego no se pierde vida hasta que cae la **última** bola.
- [ ] Recoger una cápsula apaga el efecto anterior: nunca hay paddle largo y láser a la vez.
- [ ] Perder una vida o cambiar de nivel limpia las cápsulas en vuelo y los efectos activos.
- [ ] La puntuación, las vidas y el nivel del HUD de la plataforma coinciden en todo momento con la partida, y **no** hay ningún HUD pintado dentro del canvas.
- [ ] El canvas no muestra los overlays `PAUSA`, `GAME OVER`, `¡VICTORIA!` ni `¡NIVEL COMPLETADO!`.
- [ ] Despejar un nivel suma una vida, sube el nivel del HUD y carga la rejilla siguiente con la bola pegada al paddle, sin esperar a ningún gesto.
- [ ] Despejar el nivel 5 abre el modal de fin de partida con la puntuación conseguida.
- [ ] Perder la última vida abre el modal de fin de partida con la puntuación real.
- [ ] Teclear `LEVEL` en pausa no salta de nivel: el truco no existe en el port.
- [ ] El juego es mudo y no escribe nada en `localStorage`.
- [ ] `PAUSA` congela bolas, cápsulas y explosiones, y `REANUDAR` continúa sin saltos ni teletransportes.
- [ ] Con el láser activo, pausar 20 segundos no consume el tiempo restante del efecto.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante y permite guardarla.
- [ ] `JUGAR DE NUEVO` reinicia en el nivel 1 con 3 vidas y puntuación 0, sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado o de ratón, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'arkanoid'` y aparece en `/salon?juego=arkanoid`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] `/juegos` lista nueve fichas y la de Arkanoid aparece bajo el filtro ARCADE con su portada propia.
- [ ] La ficha `bloque-buster` sigue existiendo, sigue abriendo la maqueta y conserva sus tres filas en `scores`.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor ni la tabla de sprites.
- [ ] El PNG del spritesheet solo se descarga al entrar en `/juegos/arkanoid/jugar` (comprobable en la pestaña Red de las DevTools).
- [ ] A 375 px de ancho el juego se ve completo, con el aspecto 4:3 intacto y sin scroll horizontal.
- [ ] El paddle sigue al cursor con precisión a 1440 px y a 900 px de ancho de ventana, en el centro y en los dos extremos del canvas.
- [ ] En un dispositivo de puntero grueso aparecen los tres botones táctiles y funcionan; en escritorio no se ven.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola de `/juegos/arkanoid/jugar`.
- [ ] `lib/engines/types.ts` y `components/game-player.tsx` no tienen ninguna modificación introducida por esta spec.
- [ ] `references/started-games/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí:** reutilizar `fire` para el saque en vez de añadir `launch` a `GameAction`. `fire` ya mapea a `Space`, que es la tecla del original, y así el contrato, `ACTION_FACE`, `STEERING` y el CSS del mando se quedan intactos. Un valor nuevo solo por semántica no paga su coste.
- **Sí:** conservar el control con ratón. Es el control característico del juego y el único con el que el paddle es realmente preciso; el motor escucha el ratón sobre su propio canvas, que es DOM suyo, así que no rompe ningún invariante.
- **No:** limitarse a teclado y táctil. Más simple y sin conversión de escala, pero degrada el juego a algo notablemente peor de lo que ya existe en `references/`.
- **Sí:** copiar el PNG a `public/games/arkanoid/` y precargarlo desde `mount`. Los 30 KB solo viajan cuando alguien entra en este reproductor, y el fichero del motor sigue siendo legible.
- **No:** embeber el PNG en base64 dentro del motor. Ahorra una petición, pero mete ~40 KB de texto ilegible en el repositorio y engorda el chunk del motor.
- **No:** redibujar bloques, paddle, bola y explosiones con primitivas de canvas. Encajaría mejor con el neón de la plataforma, pero eso es un rediseño, no un port, y mezclarlo con la integración haría imposible saber qué rompió qué.
- **Sí:** ficha nueva `arkanoid` en lugar de renombrar `bloque-buster`. El usuario prefiere conservar la ficha inventada con sus marcas; el juego real entra con su propio nombre y su propia portada.
- **No:** renombrar `bloque-buster` a `arkanoid` con migración de sus tres filas. Habría evitado una novena ficha, pero borra del catálogo una entrada que el usuario quiere mantener.
- **Sí:** ARCADE y verde para la ficha nueva. Es la categoría correcta y el color libre que la distingue de `bloque-buster`, que ya es ARCADE cian.
- **Sí:** continuar automáticamente al nivel siguiente. El original espera un gesto porque tiene un overlay que anunciar; sin overlay, la espera sería un juego congelado sin explicación. El HUD ya comunica el cambio de nivel y la vida extra.
- **No:** añadir un evento de "nivel completado" al contrato para que React pinte el cartel. Sería una ampliación del contrato usada por un solo juego, y la SPEC 05 ya fijó que se amplía cuando hay dos casos reales delante.
- **Sí:** la victoria del nivel 5 emite `onGameOver`. Es la única vía de abrir el modal, y por tanto la única de inscribir la marca en el Salón de la Fama.
- **No:** repetir los cinco niveles en bucle para que la partida no acabe. Alargaría las partidas y subiría las marcas, pero es un cambio de diseño del juego.
- **Sí:** eliminar el truco `LEVEL`. Saltarse niveles es saltarse dificultad en un juego que ahora puntúa en un ranking compartido, y la pausa desde la que se tecleaba ya no es del motor.
- **Sí:** dejar el audio fuera. Los otros dos motores son mudos y el HUD del reproductor no tiene sitio para un botón de mute ni un slider; el sonido merece una spec propia que cubra los tres juegos a la vez.
- **Sí:** bandera `paused` con el `requestAnimationFrame` siempre vivo, en vez del `cancelAnimationFrame` + `resumeLoop()` del original. Es el patrón validado en los otros dos motores y evita la clase entera de errores de "quedan dos bucles corriendo".
- **Sí:** cargador de sprites perezoso con la promesa cacheada a nivel de módulo. Cumple el invariante de que importar no tiene efectos, y a la vez no descarga el PNG dos veces cuando el Strict Mode monta el efecto dos veces en desarrollo.
- **Sí:** resolución interna fija de 800×600. La geometría de la rejilla, las velocidades en px/s y las distancias de colisión están calibradas para ese tamaño, y `GRID_X * 2 + COLS * BRICK_W === W` lo ata.
- **Sí:** `references/started-games/` es solo lectura, como en las dos specs anteriores.

## Riesgos

| Riesgo                                                                                                                                         | Mitigación                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La conversión de coordenadas del ratón no tiene en cuenta las bandas del `object-fit: contain` y el paddle queda desplazado respecto al cursor | La fórmula parte de la escala real (`Math.min(rect.width / W, rect.height / H)`) y resta la banda. El criterio de aceptación lo comprueba en el centro y en los dos extremos, a dos anchos de ventana distintos.                 |
| El mando táctil se superpone al canvas y roba los eventos de ratón del motor                                                                   | El mando solo se pinta bajo `@media (pointer: coarse)`; en escritorio no existe en el layout. En táctil el paddle se mueve con los botones, que es el camino previsto.                                                           |
| El PNG tarda en cargar o falla, y el juego se queda simulando sobre un canvas negro sin que nadie sepa por qué                                 | `loadSpritesheet` resuelve también en error y el bucle sigue; `drawSprite` no dibuja nada si no hay imagen, exactamente como el original. El reproductor ya muestra `CARGANDO…` mientras el `import()` está en vuelo.            |
| El Strict Mode monta el efecto dos veces y se descarga el spritesheet dos veces, o se acumulan dos bucles                                      | La promesa del cargador está cacheada a nivel de módulo, así que la segunda llamada reutiliza la primera. `destroy()` cancela el `rAF` por su id, es idempotente y retira también los listeners de ratón del canvas.             |
| Portar 810 líneas introduce un cambio sutil (una constante mal copiada, un tramo de `POWERUP_ORDER` corrido) que solo se nota jugando          | El port es mecánico y sección a sección; se juegan los cinco niveles comparando contra `index.html` del original abierto al lado, y los criterios de aceptación fijan las tablas de puntos, la aceleración y las probabilidades. |
| Quitar el estado `levelClear` desordena el flujo de fin de nivel y deja la vida extra sin sumar, o suma dos                                    | La vida extra pasa a `loadLevel` del nivel siguiente, en un único punto; el nivel 5 sale por `onGameOver` antes de tocar `lives`. Criterio de aceptación explícito para los dos casos.                                           |
| El láser se consume durante la pausa, porque el original lo descuenta con el `dt` del bucle y ahora el bucle no se detiene                     | La bandera `paused` salta `update(dt)` entero, y `laserTime` se descuenta dentro de `update`. Hay un criterio de aceptación que pausa 20 segundos con el láser activo.                                                           |
| Una novena ficha desequilibra la rejilla de `/juegos` o la home, que estaban compuestas para ocho                                              | La rejilla es responsive y no depende del número de fichas. Se revisa a 1440, 900 y 375 px junto con el resto de comprobaciones de la spec.                                                                                      |
| La puntuación sigue viniendo del cliente                                                                                                       | Riesgo ya asumido en la SPEC 04 y no reabierto aquí.                                                                                                                                                                             |

## Lo que **no** entra en esta spec

- Audio en la plataforma, ni para Arkanoid ni para los otros dos motores.
- El truco `LEVEL` y cualquier otro atajo de nivel.
- Cambios de diseño o dificultad en el juego portado.
- Retirar o marcar como "próximamente" los seis juegos de maqueta, `bloque-buster` incluido.
- Conectar `best` y `plays` a la base de datos.
- Validación anti-trampas de las puntuaciones.
- Canvas de resolución variable.
- Realtime en el Salón de la Fama.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
