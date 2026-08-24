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
| BLOQUE BUSTER | `bloque-buster` | ARCADE | 2026-08-24 | Propuesto | Ficha ya en `lib/games.ts`, sin motor. Solapa con ARKANOID: valorar si aporta algo. |
| GLOTÓN | `gloton` | ARCADE | 2026-08-24 | Propuesto | Ficha ya en catálogo. Laberinto + IA de fantasmas: el más caro de los pendientes. |
| INVASORES | `invasores` | SHOOTER | 2026-08-24 | Propuesto | Ficha ya en catálogo. Encaja directo con `left`/`right`/`fire`; sin ampliar `GameAction`. |
| RANARIA | `ranaria` | ARCADE | 2026-08-24 | Propuesto | Ficha ya en catálogo. Usa las cuatro direcciones absolutas, ya disponibles. |
| DUELO PIXEL | `duelo-pixel` | VERSUS | 2026-08-24 | Propuesto | Única ficha VERSUS. Dos jugadores en un teclado: revisar si el HUD y el guardado de score lo admiten. |

## Descartados y por qué

Nada descartado todavía.

## Huecos detectados

- **VERSUS sin ningún motor.** `duelo-pixel` es la única ficha de la categoría y sigue sin
  implementar; el reproductor nunca se ha probado con dos jugadores.
- **PUZZLE con un solo motor** (`caida`). Espacio para un segundo puzzle de score alto.
- **ARCADE saturado**: 2 de los 4 jugables y 3 de las 5 fichas pendientes. Penalizar más
  ARCADE salvo que el juego aporte una mecánica realmente distinta.
- **Prototipos agotados**: `references/started-games/` solo tiene los tres ya portados, así
  que cualquier candidato nuevo se escribe desde cero.
