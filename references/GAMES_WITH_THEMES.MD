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
| ARKANOID | `lib/engines/arkanoid.ts` | ✅ | ✅ | ✅ | 2026-08-24 | `SKINS: Record<SkinId, ArkanoidSkin>`. El color vive en el PNG: se tiñe la lámina entera **una vez por skin** (`tintSheet` + `tintRegion`, `saturation` → `multiply` → `destination-in`) y se cachea en un `Map<SkinId, SkinAssets>`. El halo de `neon` va horneado en mosaicos por color (`buildGlowTiles`), así que en el frame el bloque es un `drawImage` sin `shadow*`. `POWERUPS` conserva `letter` y `chance`; sus colores se movieron a `skin.powerup`. |
| SERPENTINA | `lib/engines/serpentina.ts` | ✅ | ✅ | ✅ | 2026-08-24 | Las cinco constantes de color desaparecieron: ahora son `SKINS: Record<SkinId, SerpentinaSkin>`. Extra no previsto: la fruta viene de un PNG (`serpentina-sprites.ts`), así que `retro` la tiñe en un lienzo offscreen con `globalCompositeOperation = "source-in"`, cacheado por especie+color (se re-tiñe solo al comer, nunca por frame). |
| RANARIA | `lib/engines/ranaria.ts` | ✅ | ✅ | ✅ | 2026-08-25 | El motor ya nacía con `SKINS: Record<SkinId, RanariaSkin>` y `setSkin` reales (SPEC 11), pero `retro` y `neon` apuntaban a la clásica y declaraba `skins: ["clasico"]`. Se escribieron las dos paletas y se añadieron dos campos al tipo: `rejilla` y `glow`. Sin sprites: todo son primitivas de canvas. |

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
- A 2026-08-25 el único motor sin tematizar es `caida`, que declara `skins: ["clasico"]`
  y un `setSkin` vacío: lo mínimo para compilar tras la ampliación aditiva del contrato.

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

### SERPENTINA · `clasico`

La paleta del port, byte a byte, para que abrir el juego sin elegir nada se vea igual que
antes de existir las skins: fondo `#000`, rejilla `#101820` (azul de sombra, casi
invisible), cuerpo `#39ff88`, cabeza `#c8ffdd` (el mismo verde lavado hacia el blanco, que
es lo único que distingue la cabeza) y borde de segmento `#0b3d24`, verde oscuro que
dibuja los anillos. La fruta va sin teñir: la lámina `fruits.png` con sus 22 colores.

### SERPENTINA · `retro`

Fósforo ámbar de CRT, el mismo tono de referencia que la `retro` de Asteroides para que
las dos paletas retro del arcade hablen igual: fondo `#0d0a04`, rejilla `#2a1d06`, cuerpo
`#ffb000`, cabeza `#ffe9c4` (casi blanca, lo más brillante de la pantalla) y borde
`#7a5200`, ámbar quemado. Aquí sí hay decisión propia: un CRT monocromo no puede tener una
fruta multicolor, así que la fruta se tiñe plana de `#ffb000` conservando su silueta. Es
por eso que existe el lienzo auxiliar; sin monocromo no haría falta. Relleno plano,
`glow: 0`.

### SERPENTINA · `neon`

Tokens del tema arcade de `app/globals.css` sobre fondo `#04040c`: cuerpo `--cyan
#00f5ff` y cabeza `--yellow #f5ff00`, que se separa del cuerpo por tono y no solo por
luminosidad —en una serpiente larga la cabeza tiene que cantar—. Borde `#022a33`, cian muy
oscuro, para que los anillos sigan leyéndose. Rejilla `rgba(0, 245, 255, 0.12)`, visible
pero sin competir; usa el paso de celda que ya existía (25 px), no uno propio: no marca
nada nuevo. El halo es `shadowBlur: 10` y se aplica **solo a la cabeza y a la fruta**,
dentro de un `save()`/`restore()`: la serpiente puede llegar a centenares de segmentos y
una sombra por `fillRect` de cuerpo hundiría los fps sin aportar lectura. La fruta no se
tiñe: en neón conserva sus colores y solo gana el halo.

### ARKANOID · `clasico`

La lámina `/games/arkanoid/spritesheet-breakout.png` **sin teñir** y las cápsulas de
power-up con los colores del port, byte a byte: `#ff5fa8` vida, `#12246b` barra larga,
`#6fd4ff` multibola, `#9aa0a6` láser, `#ffd21e` saltar nivel, borde
`rgba(255, 255, 255, 0.85)`. Fondo `null`: se sigue haciendo solo `clearRect`, sin
`fillRect`, para que el marco CRT se transparente igual que antes de existir las skins.

### ARKANOID · `retro`

Fósforo ámbar sobre fondo `#0d0a04`. Como el color está dentro del PNG, cada recorte se
tiñe con `tintRegion`: `saturation` a gris (mantiene el relieve del bloque), `multiply`
por el color de destino (el color es el techo de luz, las sombras siguen siendo sombras)
y `destination-in` para recuperar la máscara alfa. Los siete colores de bloque se
convierten en una rampa de un solo tono, ordenada de arriba abajo del tablero para que la
fila siga leyéndose por brillo y no por matiz: rojo `#ffb000` (ámbar de referencia),
rosa `#ffc46b`, magenta `#ffd9a0`, amarillo `#ffe9c4` (el más claro), verde `#c98a00`,
cian `#9a6600`, y el gris de dos golpes en ámbar sucio `#6f5a2e`, apagado a propósito
para que se lea como «duro». Barra `#ffe9c4` y bola `#ffd28a`. `glow: 0` y sin rejilla:
un CRT ámbar no tiene halos de color.

### ARKANOID · `neon`

Saturado sobre `#04040c`, con los tokens del tema arcade de `app/globals.css` para que el
canvas hable el mismo idioma que el marco: cian `--cyan #00f5ff`, magenta `--magenta
#ff006e`, amarillo `--yellow #f5ff00`, verde `--green #00ff88`, más `#ff4da6` (rosa) y
`#b026ff` (violeta) para completar los siete bloques. El gris de dos golpes es
`#7a8cff`, un azul frío que lo separa de todo lo demás. Barra `#00f5ff`, bola `#f5ff00`.
Rejilla `rgba(0, 245, 255, 0.08)` cada 40 px, puramente decorativa. El halo
(`shadowBlur: 8`) **no se pinta por frame**: se hornea una vez por skin en un mosaico por
color (`buildGlowTiles`, `GLOW_PAD = 6` px de margen solo visual), así que los hasta 60
bloques del tablero son 60 `drawImage` limpios. Solo barra, bolas y cápsulas —cuatro o
cinco objetos— llevan `shadow*` en vivo.

### RANARIA · `clasico`

La paleta con la que nació el motor, byte a byte: orilla `#123d1f`, río `#06203f`, mediana
`#1c5c2b` (verde más claro para que la franja de descanso se lea sola), asfalto `#111111`,
línea de carril `#e8e8e8`, coches `#ffd400` y camiones `#ff5c3a`, troncos `#7a4a1e` con
veta `#4a2b10`, tortugas `#2fbf71` / caparazón `#166b3c` / hundida `#0b3a5c`, rana
`#8bff3a` y nenúfares `#1f7a3a` con borde `#8bff6a`. Cronómetro semáforo: `#39ff88` →
`#ffc23a` → `#ff3a3a`. Verde lima sobre asfalto negro, en línea con el color `green` de la
ficha del catálogo. `glow: 0`, `rejilla: null`: abrir el juego sin elegir nada se ve
exactamente igual que antes de existir el selector.

### RANARIA · `retro`

Fósforo ámbar de CRT con el mismo tono de referencia que las `retro` de Asteroides,
Serpentina y Arkanoid (`#ffb000`), para que las cuatro pantallas ámbar del arcade hablen
igual. Un solo matiz y la lectura la da la luminosidad: río `#0d0a04` (lo más oscuro de la
pantalla, y el agua es lo que mata), asfalto `#1a1204`, orilla `#2a1d06`, mediana
`#4a3208`. Vehículos en el ámbar de referencia (`#ffb000` coche, `#ffd28a` camión), troncos
`#c98a00` con veta `#7a5200`, tortugas `#ffb000` y hundidas `#4a3208` —casi fondo, que es
justo la señal de que ya no dan apoyo—. La rana es `#ffe9c4`, lo más brillante de la
pantalla, porque es lo que hay que seguir con la vista. Decisión propia: el cronómetro se
invierte respecto al color —en monocromo no existe el rojo de alarma—, así que va de
apagado (`#c98a00`) a casi blanco (`#ffe9c4`) según se agota. `glow: 0` y sin rejilla.

### RANARIA · `neon`

Tokens del tema arcade de `app/globals.css` sobre fondos casi negros: río `#040a1c`,
asfalto `#04040c`, orilla `#06120a`, mediana `#0a2a16`. Rana `--green #00ff88`, y el borde
del nenúfar en ese mismo verde: el destino habla el color de la rana. Coches `--yellow
#f5ff00`, camiones `--magenta #ff006e`, tortugas `--cyan #00f5ff` y troncos `#b026ff`
violeta —el único color fuera de los tokens, necesario para que tronco y tortuga no se
confundan dentro del río—. La tortuga hundida es `#0a1630`, azul de agua. Rejilla
`rgba(0, 245, 255, 0.08)` con el paso de celda que ya existía (40 px): decorativa, no marca
ninguna casilla nueva. El halo es `shadowBlur: 8` vía `applyGlow()`, **una vez por
elemento** y siempre dentro de `save()`/`restore()`, y solo en rana, borde de nenúfar,
vehículos y barra de cronómetro: troncos y tortugas van sin halo porque son las entidades
más numerosas (una tortuga son 2-3 círculos por entidad) y su sombra costaría fps sin
aportar lectura. Los ojos de la rana se pintan tras el `restore()`: son oscuros y su sombra
ensuciaba la cara.
