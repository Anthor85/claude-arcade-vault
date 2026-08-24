# Sugerencias de juegos

Memoria del agente `game-planner`. La escribe él en cada ronda; el humano puede editarla a
mano. Sirve para no volver a proponer lo mismo ni re-discutir lo ya descartado.

Estados: `Propuesto` (candidato vivo), `Descartado`, `Aprobado` (spec en marcha),
`Implementado` (motor registrado en `lib/engines/index.ts`).

## Sugerencias

| Juego | Slug | Categoría | Fecha | Estado | Motivo |
| --- | --- | --- | --- | --- | --- |
| ASTEROIDES | `asteroides` | SHOOTER | 2026-08-24 | Implementado | Spec 05. Motor `lib/engines/asteroids.ts`. |
| CAÍDA | `caida` | PUZZLE | 2026-08-24 | Implementado | Spec 06. Motor `lib/engines/tetris.ts`. |
| ARKANOID | `arkanoid` | ARCADE | 2026-08-24 | Implementado | Spec 07. Motor `lib/engines/arkanoid.ts`. |
| SERPENTINA | `serpentina` | ARCADE | 2026-08-24 | Implementado | Spec 08. Motor `lib/engines/serpentina.ts`. |
| INVASORES | `invasores` | SHOOTER | 2026-08-24 | Propuesto | **Recomendación principal de la ronda del 2026-08-24.** Ficha ya en catálogo. `left`/`right`/`fire` sin ampliar `GameAction`; score, vidas y oleada = nivel encajan directos en el HUD. |
| RANARIA | `ranaria` | ARCADE | 2026-08-24 | Propuesto | Alternativa 1 y **mejor del lote ARCADE en la ronda 16**. Ficha ya en catálogo. Usa las cuatro direcciones absolutas, ya disponibles. Mecánica distinta de todo lo jugable (avance por carriles, sin disparo ni pelota). ~400-480 líneas; el temporizador se pinta dentro del canvas. |
| GLOTÓN | `gloton` | ARCADE | 2026-08-24 | Propuesto | Alternativa 2 (ronda 16: 3.º del lote ARCADE). Ficha ya en catálogo. Laberinto + IA de cuatro fantasmas y modo píldora: el más caro de los pendientes, ~700-850 líneas, y su movimiento en rejilla se solapa con SERPENTINA. |
| DUELO PIXEL | `duelo-pixel` | VERSUS | 2026-08-24 | Propuesto | Cubre el único hueco de categoría, pero bloqueado por diseño: score de duelo (marcador a 24) no es puntuación creciente y el modo a dos jugadores no tiene encaje en el Salón de la Fama. **Ronda 16 propone la salida**: reconvertirlo en REBOTE, frontón solo contra CPU con score por rally (`up`/`down`/`fire`, ~350-420 líneas), renunciando al 2P local y reescribiendo el `best: 24` de la ficha. Sigue requiriendo decisión de producto antes de la spec. |
| CIEMPIÉS | `ciempies` | SHOOTER | 2026-08-24 | Propuesto | Ronda 16 (lote SHOOTER, 1.º). Ficha nueva. Oruga segmentada sobre rejilla de setas destructible: mecánica inédita en el catálogo. `left`/`right`/`up`/`down`/`fire`, sin ampliar `GameAction`. ~450-550 líneas. Llena el HUD entero sin decisiones pendientes. |
| BARRERA ORBITAL | `barrera` | SHOOTER | 2026-08-24 | Propuesto | Ronda 16 (lote SHOOTER, 2.º). Ficha nueva. Missile Command: retícula y explosiones encadenadas. ~400-500 líneas, sin sprites. Pendiente decidir en spec el mapeo vidas↔ciudades (`hasLives`). |
| CAUCE | `cauce` | SHOOTER | 2026-08-24 | Propuesto | Ronda 16 (lote SHOOTER, 3.º). Ficha nueva. Shmup vertical con combustible (River Raid). `thrust` regula el scroll. ~500-600 líneas. El generador procedural del cañón es el trabajo real; el combustible no cabe en el HUD y se pinta en canvas. |
| CENTINELA | `centinela` | SHOOTER | 2026-08-24 | Propuesto | Ronda 16 (lote SHOOTER, 4.º). Ficha nueva. Defender con mundo cíclico y minimapa. ~700-800 líneas, el más caro y arriesgado del lote; la acción de invertir sentido fuerza `rotate` o amplía `GameAction`. |
| TUBERÍAS | `tuberias` | PUZZLE | 2026-08-24 | Propuesto | Ronda 16 (lote PUZZLE, 1.º). Ficha nueva. Colocar tubería en carrera contra el flujo. Cursor + `fire`/`rotate`/`drop`, todo existente. ~450-550 líneas. Score creciente natural; equilibra PUZZLE sin solapar con `caida`. |
| COLUMNAS | `columnas` | PUZZLE | 2026-08-24 | Propuesto | Ronda 16 (lote PUZZLE, 2.º). Ficha nueva. Match-3 con gemas que caen y cascadas. El más barato del lote (~350-450 líneas) y mapeo de acciones idéntico a `caida` — y ahí está el problema: se percibe como otro Tetris. |
| CAVERNAS | `cavernas` | PUZZLE | 2026-08-24 | Propuesto | Ronda 16 (lote PUZZLE, 3.º). Ficha nueva. Boulder Dash: excavar tierra, diamantes y rocas que caen en cascada. ~600-750 líneas más el diseño de cuevas como datos. HUD limpio, pero puede quedar más ARCADE que PUZZLE. Distinto de `excavador` (Dig Dug): renombrado para evitar choque de slug. |
| FUSIÓN | `fusion` | PUZZLE | 2026-08-24 | Propuesto | Ronda 16 (lote PUZZLE, 4.º). Ficha nueva. Deslizar y fundir en rejilla 4×4. Coste mínimo (~250-300 líneas) pero peor encaje de tono: por turnos, sin presión temporal y de 2014, fuera del registro retro. |
| EXCAVADOR | `excavador` | ARCADE | 2026-08-24 | Propuesto | Ronda 16 (lote ARCADE, 2.º). Ficha nueva. Dig Dug: túneles, arpón que infla y rocas que aplastan. ~550-650 líneas. Mecánica de excavado genuinamente nueva; la IA en modo fantasma es donde se va el tiempo. |
| TREPADOR | `trepador` | ARCADE | 2026-08-24 | Propuesto | Ronda 16 (lote ARCADE, 4.º). Ficha nueva. Donkey Kong: plataformas, escaleras y barriles. **Bloqueado por contrato**: no existe acción `jump` y reutilizar `fire`/`thrust` miente en el mando táctil. Solo viable si se acepta ampliar `GameAction`. ~600-700 líneas y física de plataformas sin motor comparable en el repo. |
| AUTOPISTA | `autopista` | ARCADE | 2026-08-24 | Propuesto | Ronda 16 (lote CARRERAS, 2.º). Ficha nueva. Conducción top-down con scroll vertical, tráfico y combustible. `left`/`right`/`thrust`/`down`, sin ampliar `GameAction`. ~450-550 líneas. Mantenerlo plano: nada de pseudo-3D. Refuerza ARCADE, ya saturado. |
| SALTADOR | `saltador` | ARCADE | 2026-08-24 | Propuesto | Ronda 16 (lote CARRERAS, 3.º). Ficha nueva. Endless runner de dos botones (`up`/`down`). El más barato de toda la ronda (~250-330 líneas). Riesgo: poca profundidad y score puramente temporal, que aplasta el ranking si la aceleración no es agresiva. |
| ARTILLERÍA | `artilleria` | SHOOTER | 2026-08-24 | Propuesto | Ronda 16 (lote CARRERAS, 4.º). Ficha nueva. Tiro parabólico con viento. ~350-450 líneas; estrena la semántica de mantener y soltar `fire` vía `setInput`. Riesgo de ritmo: por turnos, exigiría cronómetro por tirada, y `onLives` como munición confunde en el HUD. |
| BLOQUE BUSTER | `bloque-buster` | ARCADE | 2026-08-24 | Descartado | Duplica ARKANOID, ya jugable. Ver abajo. |

## Descartados y por qué

- **BLOQUE BUSTER** (2026-08-24). Misma mecánica exacta que ARKANOID (`lib/engines/arkanoid.ts`,
  spec 07): paleta, bola, rejilla de bloques, cápsulas, misma categoría ARCADE y mismas acciones
  `left`/`right`/`fire`. Portarlo daría un segundo breakout sin mecánica nueva en la categoría
  ya saturada. No volver a proponerlo como motor: lo razonable es retirar la ficha de
  `lib/games.ts` o reconvertirla a otro juego, decisión del humano.

## Ronda del 2026-08-24 — 16 candidatos

Lanzada en cuatro lotes paralelos (SHOOTER, PUZZLE, ARCADE, CARRERAS/otros). Notas
transversales que solo salen al comparar los lotes entre sí:

- **La ausencia de una acción `jump` en `GameAction` bloquea todo el género de plataformas**
  (TREPADOR y cualquier Donkey Kong / Mario-like). Reutilizar `fire` o `thrust` rompe la
  semántica del mando táctil. Decisión pendiente del humano: ampliar el contrato — tocando
  `ACTION_FACE` y `STEERING` en `components/game-player.tsx` — o renunciar al género.
- **Coste de ficha.** Solo `invasores`, `ranaria`, `gloton` y `duelo-pixel` tienen ficha en
  `lib/games.ts`. Los otros 13 candidatos exigen entrada nueva, textos y clase `cover-*` en
  `app/globals.css`. A igualdad de encaje, preferir los que ya tienen ficha.
- **Colisión de slug resuelta.** Dos lotes propusieron `excavador` para juegos distintos.
  Queda `excavador` = Dig Dug (ARCADE) y `cavernas` = Boulder Dash (PUZZLE).
- **Indicadores que no caben en el HUD** (combustible en CAUCE, cronómetro en RANARIA y
  ARTILLERÍA): se pintan dentro del canvas. Es legal, pero hay que escribirlo en la spec.
- **Ranking.** Los candidatos de score puramente temporal (SALTADOR) o inflacionario por
  cascadas (COLUMNAS) distorsionan el Salón de la Fama frente a los motores ya publicados.

## Huecos detectados

- **VERSUS sigue sin ningún motor.** `duelo-pixel` es la única ficha de la categoría. El
  bloqueo no es técnico de canvas sino de puntuación: la plataforma asume un score numérico
  creciente por jugador. Opción viable: implementarlo solo contra CPU y puntuar por rally o
  por diferencia de tantos.
- **PUZZLE con un solo motor** (`caida`). Sigue habiendo espacio para un segundo puzzle de
  score alto, pero no hay ficha en `lib/games.ts` para él: exigiría ficha nueva + portada.
- **SHOOTER con un solo motor** (`asteroides`). `invasores` lo equilibra sin coste de ficha.
- **ARCADE saturado**: 2 de los 4 jugables y (tras descartar `bloque-buster`) 2 de las 4 fichas
  pendientes. Penalizar ARCADE salvo mecánica realmente distinta (caso de `ranaria`).
- **Prototipos agotados**: `references/started-games/` solo tiene los tres ya portados
  (`02-claude-asteroids`, `03-claude-tetris`, `04-claude-arkanoid`). Cualquier candidato nuevo
  se escribe desde cero.
