# Juegos con skins

Memoria del agente `skin-designer`. La escribe él en cada ejecución; el humano puede
editarla a mano.

Skins obligatorias en todo juego jugable: `clasico` (la paleta original, por defecto),
`retro` y `neon`.

## Estado por juego

| Juego | Motor | clasico | retro | neon | Fecha | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| ASTEROIDES | `lib/engines/asteroids.ts` | ✅ | ✅ | ✅ | 2026-08-24 | Colores extraídos de los literales inline a `SKINS: Record<SkinId, AsteroidsSkin>`. `POWERUP_COLOR` desapareció: ahora es `skin.powerup`. |
| CAÍDA | `lib/engines/tetris.ts` | — | — | — | 2026-08-24 | Solo contrato propagado (`skins: ["clasico"]`, `setSkin` vacío). Ojo: el comentario de `COLORS` dice que esa paleta **era la skin `retro` del original**; al tematizarlo, esa paleta pasa a `clasico` y la `retro` nueva debe ser visiblemente distinta. |
| ARKANOID | `lib/engines/arkanoid.ts` | — | — | — | 2026-08-24 | Solo contrato propagado. El color vive dentro de `/games/arkanoid/spritesheet-breakout.png`, vía `BrickColor` y `SPRITES.blocks`: hay que teñir en un canvas offscreen con `globalCompositeOperation` y cachear por skin. Caso caro. |
| SERPENTINA | `lib/engines/serpentina.ts` | — | — | — | 2026-08-24 | Solo contrato propagado. Cinco constantes de color (`BACKGROUND`, `GRID_LINE`, `SNAKE_BODY`, `SNAKE_HEAD`, `SNAKE_EDGE`): caso trivial. |

## Mecanismo transversal

**Existe desde 2026-08-24.** Construido al tematizar `asteroides`.

- `lib/engines/types.ts`: `export type SkinId = "clasico" | "retro" | "neon"`,
  `GameEngine.skins: readonly SkinId[]` (siempre incluye `"clasico"`) y
  `GameHandle.setSkin(skin)`, que cambia la paleta **sin desmontar** y repinta al
  instante, aunque la partida esté en pausa o terminada. El bloque de invariantes de la
  cabecera recoge la regla dura: la skin solo afecta al dibujado; no toca geometría,
  hitboxes, tiempos ni puntuación.
- `components/game-player.tsx`: `EngineMeta` lleva `skins`, rellenado en el `onReady`
  de `CanvasArena`. El selector se pinta en `hud-actions`, junto a PAUSA / FIN / SALIR,
  y solo si `meta.skins.length > 1`. Cambiarlo llama a `handleRef.current?.setSkin(id)`.
  **La skin no es prop de `CanvasArena`**: sus dependencias de `useEffect` siguen siendo
  `[gameId, handleRef, onScore, onLives, onLevel, onGameOver, onReady]`, así que cambiar
  de paleta a media partida no remonta el canvas ni reinicia nada.
- Persistencia: `localStorage`, clave `arcade-vault:skin:<gameId>`, leída con guarda
  (`typeof window === "undefined"` + `try/catch`) y reaplicada tras `onReady`.
- Estilo: `.skinField` / `.skinLabel` / `.skinSelect` en `components/player.module.css`.
- Los tres motores no tematizados declaran `skins: ["clasico"]` y un `setSkin` vacío.
  Es lo mínimo para que compilen tras la ampliación aditiva del contrato.

## Decisiones de paleta

### ASTEROIDES · `clasico`

La paleta del port, byte a byte, para que abrir el juego sin haber elegido nada se vea
exactamente igual que antes de existir las skins: fondo `#000`, nave, asteroides y balas
en `#fff`, llama del propulsor `rgba(255, 130, 0, 0.85)`, escudo `rgba(255, 210, 77, 0.8)`,
rastro de partícula en blanco con alfa decreciente, power-ups `#4df3ff` (triple) y
`#ffd24d` (escudo). Sin halo (`glow: 0`) y sin rejilla. Es el vector blanco sobre negro
del arcade original de 1979.

### ASTEROIDES · `retro`

Fósforo ámbar de monitor CRT. Un solo tono y la lectura la da la luminosidad, no el
matiz: fondo `#0d0a04` (negro cálido, no puro), asteroides en el ámbar de referencia
`#ffb000`, nave en ámbar claro `#ffd28a` para que se distinga de las rocas sin cambiar de
color, balas casi blancas `#ffe9c4` porque son lo más brillante de la pantalla, llama y
escudo en ámbar medio. Power-ups en los dos extremos de la misma rampa (`#ffd28a` claro
para triple, `#c98a00` oscuro para escudo), que es lo único que los separa. Relleno plano,
`glow: 0`, sin rejilla: un CRT ámbar no tiene halos de color.

### ASTEROIDES · `neon`

Saturado sobre fondo casi negro, con los tokens del tema arcade de `app/globals.css` para
que el canvas hable el mismo idioma que el marco CRT que lo rodea: nave `--cyan #00f5ff`,
asteroides `--magenta #ff006e`, balas `--yellow #f5ff00`, escudo y power-up de triple en
`--green #00ff88`. Fondo `#04040c`, más azulado que el negro de `clasico`, y rejilla
`rgba(0, 245, 255, 0.08)` cada 40 px, puramente decorativa: no marca casillas ni alinea
nada del juego. El halo es `shadowBlur: 8` con `shadowColor` igual al trazo, aplicado por
`applyGlow()` **una vez por entidad** y siempre dentro de un `save()`/`restore()`, nunca
por vértice: es la skin más cara de pintar y así no hunde los fps.
