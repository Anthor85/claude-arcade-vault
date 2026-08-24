# Juegos implementados

Estado del catálogo de Arcade Vault. "Jugable" = tiene motor real registrado en
`lib/engines/index.ts`; el resto usa la maqueta del reproductor.

## Jugables (4)

| Juego | `id` | Motor | Categoría | Spec |
| --- | --- | --- | --- | --- |
| ASTEROIDES | `asteroides` | `lib/engines/asteroids.ts` | SHOOTER | [05](../specs/05-asteroides-jugable.md) |
| CAÍDA (Tetris) | `caida` | `lib/engines/tetris.ts` | PUZZLE | [06](../specs/06-caida-jugable.md) |
| ARKANOID | `arkanoid` | `lib/engines/arkanoid.ts` | ARCADE | [07](../specs/07-arkanoid-jugable.md) |
| SERPENTINA | `serpentina` | `lib/engines/serpentina.ts` | ARCADE | [08](../specs/08-serpentina-jugable.md) |

## Pendientes de motor (5)

Están en el catálogo (`lib/games.ts`) con ficha y portada, pero sin motor.

| Juego | `id` | Categoría | Origen |
| --- | --- | --- | --- |
| BLOQUE BUSTER | `bloque-buster` | ARCADE | — |
| GLOTÓN | `gloton` | ARCADE | — |
| INVASORES | `invasores` | SHOOTER | — |
| RANARIA | `ranaria` | ARCADE | — |
| DUELO PIXEL | `duelo-pixel` | VERSUS | — |

## Prototipos sin portar

`references/started-games/` conserva los juegos sueltos de partida. Los tres
existentes ya se portaron: `02-claude-asteroids`, `03-claude-tetris`,
`04-claude-arkanoid`.

## Cómo añadir uno

1. `/integrar-juego` escribe la spec sobre el contrato `GameEngine`.
2. Revisar y marcar la spec como **Aprobado** (lo hace el humano).
3. `/spec-impl` implementa el motor y lo registra en `lib/engines/index.ts`.
4. Actualizar este listado.
