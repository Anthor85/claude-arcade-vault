# Juegos con skins

Memoria del agente `skin-designer`. La escribe él en cada ejecución; el humano puede
editarla a mano.

Skins obligatorias en todo juego jugable: `clasico` (la paleta original, por defecto),
`retro` y `neon`.

## Estado por juego

| Juego | Motor | clasico | retro | neon | Fecha | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| ASTEROIDES | `lib/engines/asteroids.ts` | — | — | — | — | Sin auditar. Colores como literales inline por todo el dibujado. |
| CAÍDA | `lib/engines/tetris.ts` | — | — | — | — | Sin auditar. La SPEC 06 dejó las skins fuera de alcance y portó solo una paleta. |
| ARKANOID | `lib/engines/arkanoid.ts` | — | — | — | — | Sin auditar. El color vive dentro del spritesheet PNG: caso caro. |
| SERPENTINA | `lib/engines/serpentina.ts` | — | — | — | — | Sin auditar. Cinco constantes de color, caso trivial. |

## Mecanismo transversal

**No existe.** El contrato de `lib/engines/types.ts` no tiene `SkinId`, `GameEngine` no
declara `skins` y `GameHandle` no tiene `setSkin`. `components/game-player.tsx` monta con
`engine.mount(canvas, events)` y no tiene selector ni UI de ajustes.

La primera ejecución del agente sobre cualquier juego debe construirlo.

## Decisiones de paleta

Vacío. Una entrada por juego y skin cuando se implementen.
