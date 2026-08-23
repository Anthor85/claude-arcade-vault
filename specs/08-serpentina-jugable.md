# SPEC 08 — Serpentina jugable: la serpiente de Nokia con frutas

> **Estado:** Aprobada
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-08-23
> **Objetivo:** Escribir desde cero el motor `lib/engines/serpentina.ts` —una serpiente de rejilla al estilo del Snake de los Nokia, con tres vidas, velocidad creciente y frutas dibujadas con la lámina de `references/source-assets/snake-assets`— y conectarlo a la ficha `serpentina`, de modo que `/juegos/serpentina/jugar` sea una partida real cuya puntuación se inscribe en el Salón de la Fama.

## Por qué existe esta spec

La plataforma tiene ya tres juegos reales: Asteroides (SPEC 05), Caída (SPEC 06) y Arkanoid (SPEC 07). `serpentina` sigue siendo una ficha del catálogo sin motor: entrar en `/juegos/serpentina/jugar` cae en `MockArena`, la simulación que sube la puntuación sola con un `setInterval`. Se puede guardar en `scores` un número que nadie ha jugado.

A diferencia de las tres specs anteriores, aquí **no hay un port**: `references/started-games/` no contiene ningún Snake. Lo único que aporta el material de partida es el arte:

- `references/source-assets/snake-assets/fruits.png` — lámina de 3790×442 px con fondo transparente, 585 KB, sacada de spriters-resource.
- `references/source-assets/snake-assets/sprites.js` — declara `window.SPRITE_ATLAS` con 22 recortes de frutas de la fila `y = 136–295`.

Ese `sprites.js` no se puede usar tal cual, por lo mismo que no se pudo usar `assets/spritesheet.js` en la SPEC 07: escribe en `window`, no exporta nada, no está tipado y apunta al PNG con una ruta relativa (`snake-assets/fruits.png`) que en Next no existe. La lógica del juego, en cambio, se especifica entera en esta spec y se escribe directamente contra el contrato `GameEngine`, sin nada que portar.

Hay además un desajuste real del contrato que este juego es el primero en encontrarse: `GameAction` no tiene un valor para "arriba". Snake necesita las cuatro direcciones absolutas.

> **Aviso de versión.** No se introduce ninguna API de Next. El motor se carga con el mismo `import()` dinámico dentro del efecto de `components/game-player.tsx` que ya usan los otros tres. Consultar `node_modules/next/dist/docs/` antes de tocar cualquier cosa de routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Motor nuevo** en `lib/engines/serpentina.ts`, que exporta `serpentinaEngine: GameEngine`: rejilla de 24×24 celdas sobre un canvas interno de 600×600, serpiente que crece al comer, tres vidas, muros mortales y velocidad creciente por nivel.
- **Atlas de frutas** en `lib/engines/serpentina-sprites.ts`: los 22 recortes de `sprites.js` convertidos a un módulo TypeScript tipado, con carga diferida que nunca rechaza, siguiendo el patrón ya validado en `lib/engines/arkanoid-sprites.ts`.
- **Asset estático**: `public/games/serpentina/fruits.png`, copia byte a byte del original.
- **Ampliación del contrato**: valor `"up"` en `GameAction` (`lib/engines/types.ts`), su glifo en `ACTION_FACE` y su entrada en `STEERING` (`components/game-player.tsx`).
- **Registro** de `serpentina` en `ENGINES` (`lib/engines/index.ts`), con `import()` diferido.
- **Textos de la ficha** `serpentina` en `lib/games.ts`: `short` y `long` reescritos para describir el juego real. El `id` no cambia.
- **Portada** `.cover-snake` en `app/globals.css`, rehecha para que el objetivo sea una fruta y no un núcleo magenta.
- Ayuda de controles bajo el marco CRT: las cuatro flechas.

**Fuera (otra spec si llega):**

- **Audio.** Sin sonido de bocado ni de choque. Los tres motores existentes son mudos; el sonido va en una spec transversal que los cubra a los cuatro a la vez.
- **Obstáculos y niveles con muros interiores.** La rejilla está siempre vacía; lo único que cambia con el nivel es la velocidad.
- **Récord local en `localStorage`** y **validación anti-trampas** de la puntuación. Sigue vigente el riesgo asumido en la SPEC 04: la marca la envía el cliente.
- **Dificultad seleccionable** (velocidad inicial, tamaño de rejilla, bordes que envuelven). Los valores de esta spec son fijos.
- Serpiente dibujada con sprites, frutas con valores distintos según especie, frutas especiales o temporizadas.
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos. Siguen inventados en las nueve fichas.
- Retirar la maqueta de los juegos que aún no tienen motor.
- Realtime en el Salón de la Fama (pendiente desde la SPEC 04).
- Tests automatizados: el proyecto no tiene framework de tests.
- Modificar `references/`. Es material de referencia de solo lectura; el atlas es una copia en `lib/engines/`.

## Modelo de datos

No hay tablas nuevas, ni columnas nuevas, ni migración. La ficha conserva su `id` (`serpentina`) y `scores` no tiene ninguna fila con ese `game_id` que reubicar.

### Del material original al port

| Original (`snake-assets/sprites.js`)                    | Port (`lib/engines/serpentina-sprites.ts`)                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `window.SPRITE_ATLAS = { … }`                           | `export const FRUITS: Record<FruitName, SpriteFrame>`                                       |
| Claves sueltas sin tipo                                 | `export type FruitName` derivado del propio objeto, sin `any`                               |
| `sources.fruits = 'snake-assets/fruits.png'`            | `const SHEET_URL = "/games/serpentina/fruits.png"`, ruta absoluta                           |
| Sin cargador: el juego usaba un `<img>` del HTML        | `loadFruitSheet()`: promesa cacheada a nivel de módulo, que resuelve `null` en error        |
| `ctx.drawImage(img, x, y, w, h, dx, dy, dw, dh)` a mano | `drawFruit(ctx, sheet, name, cx, cy, size)`, que centra el recorte y conserva su proporción |

Los recortes miden 160 px de alto y entre 110 y 170 de ancho. `drawFruit` escala por el alto de la celda y centra en horizontal: una banana estrecha y un kiwi ancho ocupan la misma altura y ninguno se deforma.

### Contrato — `lib/engines/types.ts`

Se añade un único valor a la unión:

```ts
/** Ir hacia arriba. Cuarta dirección absoluta. */
| "up"
```

Es la segunda ampliación del contrato (la primera fue `down`, `rotate` y `drop` en la SPEC 06) y sigue la regla que fijó la SPEC 05: se amplía cuando hay un caso real delante. Arrastra dos cambios en `components/game-player.tsx`:

- `ACTION_FACE.up = { glyph: "▲", label: "Ir arriba" }`.
- `STEERING` pasa a `["up", "left", "right", "down"]`, para que las cuatro flechas caigan en el grupo de dirección del mando y no en el de acción.

`thrust` conserva su glifo `▲` con la etiqueta "Propulsar": ningún motor declara las dos acciones a la vez, así que no hay ambigüedad en pantalla.

### Estado del reproductor

`components/game-player.tsx` solo cambia en esas dos constantes. `hasLives: true` hace que el HUD muestre `Vidas` sin más trabajo. `components/player.module.css` **no cambia**: cuatro botones de 60 px con `gap: 12px` y `padding: 16px` suman 308 px, así que la fila entra en una pantalla de 375 px.

### Reglas del juego

| Concepto           | Valor                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas interno     | 600×600 px, rejilla de 24×24 celdas de 25 px                                                                                                                                               |
| Serpiente inicial  | 4 segmentos en el centro, avanzando a la derecha                                                                                                                                           |
| Paso               | 140 ms en el nivel 1, −10 ms por nivel, con suelo en 60 ms                                                                                                                                 |
| Nivel              | `1 + floor(frutas / 5)`, con tope en 9                                                                                                                                                     |
| Puntuación         | +10 por fruta, sin bonus por especie                                                                                                                                                       |
| Crecimiento        | +1 segmento por fruta                                                                                                                                                                      |
| Vidas              | 3                                                                                                                                                                                          |
| Muerte             | Chocar con un muro o con el propio cuerpo                                                                                                                                                  |
| Al perder una vida | La serpiente vuelve al centro con 4 segmentos; la puntuación se conserva, pero el contador de frutas vuelve a 0, así que el nivel baja a 1 y el paso vuelve a 140 ms; la fruta se recoloca |
| Fin de partida     | Al perder la tercera vida                                                                                                                                                                  |
| Fruta              | Especie elegida al azar entre las 22 del atlas, en una celda libre al azar                                                                                                                 |

El giro se guarda en una cola de a lo sumo dos direcciones que se consume un paso por tick. Sin ella, pulsar `↑` y `←` dentro del mismo tick invierte el rumbo 180º y la serpiente se muerde sola. Un giro que invierta la dirección vigente se descarta al encolarlo.

## Plan de implementación

1. **Asset y atlas.** Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/serpentina/fruits.png` sin modificarlo. Crear `lib/engines/serpentina-sprites.ts` con `SpriteFrame`, `FRUITS`, `FruitName`, `FRUIT_NAMES`, `loadFruitSheet` y `drawFruit`, tipados y sin efectos al importar. Prueba manual: con `npm run dev`, abrir `http://localhost:3000/games/serpentina/fruits.png` y ver la lámina; `npx tsc --noEmit` pasa.
2. **Contrato y mando.** Añadir `"up"` a `GameAction` en `lib/engines/types.ts`, su entrada en `ACTION_FACE` y su posición en `STEERING` dentro de `components/game-player.tsx`. Prueba manual: `npx tsc --noEmit` pasa y los reproductores de Asteroides, Caída y Arkanoid siguen pintando exactamente los mismos botones que antes.
3. **Motor.** Crear `lib/engines/serpentina.ts` con la mecánica de la tabla de reglas: closure en `mount`, `canvas` por parámetro, `ACTION_KEYS` que escribe en el mismo mapa de teclas que el teclado, `SCROLL_KEYS` con `preventDefault` para las flechas, bandera `paused` que salta el `update` sin parar el `requestAnimationFrame`, acumulador de tiempo con `dt` acotado, listeners retirados en un `destroy` idempotente. Sin HUD ni overlays dentro del canvas. Exportar `serpentinaEngine`. Prueba manual: `npx tsc --noEmit` pasa sin un solo `any`.
4. **Registro.** Añadir `serpentina: () => import("./serpentina").then((m) => m.serpentinaEngine)` a `ENGINES` en `lib/engines/index.ts`. Prueba manual: `npm run build` pasa y el chunk del motor aparece como carga diferida.
5. **Canvas jugable.** Sin más cambios en el reproductor, comprobar que `/juegos/serpentina/jugar` monta el canvas real. Prueba manual: jugar hasta comer cinco frutas; la puntuación marca 50, el nivel sube a 2, la serpiente es visiblemente más rápida y no hay ningún HUD ni overlay dentro del canvas.
6. **Vidas y fin de partida.** Prueba manual: chocar contra un muro, contra el propio cuerpo y agotar las tres vidas; el HUD descuenta, la serpiente reaparece en el centro conservando la puntuación y con el nivel de vuelta a 1, y la tercera muerte abre el modal con la marca real.
7. **Ficha y portada.** Reescribir `short` y `long` de `serpentina` en `lib/games.ts` (frutas, tres vidas, velocidad creciente) y rehacer `.cover-snake` en `app/globals.css` para que el objetivo lea como una fruta. Prueba manual: `/juegos` sigue listando nueve fichas, la de Serpentina bajo el filtro ARCADE con su portada nueva, y `/juegos/serpentina` muestra el texto actualizado.
8. **Pausa, fin y reinicio.** Prueba manual: `PAUSA` congela la serpiente, `REANUDAR` continúa sin saltos ni teletransportes, `FIN` abre el modal con lo marcado, `JUGAR DE NUEVO` reinicia con 3 vidas y puntuación 0, y cambiar de pestaña deja la partida pausada.
9. **Controles táctiles.** Prueba manual: en el emulador de móvil de las DevTools aparecen `◀ ▲ ▼ ▶` en el grupo de dirección, los cuatro giran la serpiente y no hay ningún botón en el grupo de acción; en escritorio el mando no se ve.
10. **Guardado de la marca.** Prueba manual: jugar con sesión, guardar desde el modal y ver la marca en `/salon?juego=serpentina`.
11. **Repaso final.** `npm run build`, `npm run format:check` y revisión de la consola en `/juegos/serpentina/jugar` (sin errores de hidratación ni avisos de React). Comprobar que Asteroides, Caída y Arkanoid siguen jugándose igual.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y ni `lib/engines/serpentina.ts` ni `lib/engines/serpentina-sprites.ts` contienen ningún `any`.
- [ ] `/juegos/serpentina/jugar` muestra un canvas jugable en el que las cuatro flechas giran la serpiente.
- [ ] Las frutas se dibujan con recortes de `fruits.png`, centradas en su celda y sin deformarse, y la especie cambia entre bocados.
- [ ] Cada fruta suma 10 puntos y un segmento.
- [ ] El nivel del HUD es `1 + floor(frutas / 5)` con tope en 9, y el paso baja 10 ms por nivel desde 140 ms hasta un suelo de 60 ms.
- [ ] Chocar contra un muro o contra el propio cuerpo resta una vida, devuelve la serpiente al centro con 4 segmentos, conserva la puntuación y devuelve el nivel a 1 con el paso a 140 ms.
- [ ] Perder la tercera vida abre el modal de fin de partida con la puntuación real.
- [ ] Pulsar dos flechas dentro de un mismo paso no invierte el rumbo 180º ni provoca una muerte instantánea.
- [ ] La fruta nunca aparece sobre una celda ocupada por la serpiente.
- [ ] La puntuación, las vidas y el nivel del HUD coinciden en todo momento con la partida, y **no** hay ningún HUD pintado dentro del canvas.
- [ ] El canvas no muestra overlays de pausa, de fin de partida ni de reinicio.
- [ ] El juego es mudo y no escribe nada en `localStorage`.
- [ ] `PAUSA` congela la serpiente por completo y `REANUDAR` continúa sin saltos; una pausa larga no encadena varios pasos de golpe al volver.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante y permite guardarla.
- [ ] `JUGAR DE NUEVO` reinicia con 3 vidas, nivel 1 y puntuación 0, sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'serpentina'` y aparece en `/salon?juego=serpentina`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] `/juegos` sigue listando nueve fichas y la de Serpentina aparece bajo el filtro ARCADE con su portada nueva.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor ni el atlas de frutas.
- [ ] El PNG de las frutas solo se descarga al entrar en `/juegos/serpentina/jugar` (comprobable en la pestaña Red de las DevTools).
- [ ] Con el PNG bloqueado, la partida se sigue jugando: la fruta se dibuja como un cuadro liso y no salta ningún error.
- [ ] A 375 px de ancho el juego se ve completo, cuadrado, sin recortes ni scroll horizontal, y los cuatro botones táctiles caben en una fila.
- [ ] Los reproductores de Asteroides, Caída y Arkanoid pintan exactamente los mismos botones táctiles que antes de esta spec.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola de `/juegos/serpentina/jugar`.
- [ ] `supabase/migrations/` no gana ningún archivo por esta spec.
- [ ] `references/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí:** añadir `"up"` a `GameAction`. Es la cuarta dirección absoluta de un juego de rejilla; sin ella el mando táctil no puede expresar el control del juego. El coste es una línea en el contrato y dos en el reproductor.
- **No:** reutilizar `thrust` como "arriba". No habría tocado el contrato, pero su glifo se llama "Propulsar" y cae en el grupo de acción del mando, a la derecha: la cruceta quedaría partida en dos por una etiqueta mentirosa.
- **No:** control por giro relativo con solo `left` y `right`. Cabía en el contrato actual, pero el Snake de Nokia es de direcciones absolutas y el control relativo cambia el juego.
- **Sí:** tres vidas en vez del morir-y-acabar del original. El HUD del reproductor tiene un campo `Vidas` y `hasLives: false` lo dejaría vacío en un juego de arcade; tres vidas alargan la partida sin cambiar la mecánica.
- **Sí:** conservar la puntuación al perder una vida. Reiniciarla convertiría cada vida en una partida distinta y haría el marcador ilegible.
- **Sí:** reiniciar el contador de frutas al perder una vida, y con él el nivel y la velocidad. Heredar el paso que acaba de matar al jugador encadena las tres muertes seguidas; empezar cada vida a 140 ms le devuelve el margen para recuperarse. El marcador no se resiente porque la puntuación sí se conserva.
- **Sí:** usar `fruits.png` para la fruta y dibujar la serpiente con primitivas en verde neón. Aprovecha el material aportado en lo único que cubre y mantiene el juego dentro del lenguaje visual de la plataforma.
- **No:** buscar o dibujar una lámina de serpiente para completar el arte. Es un encargo de ilustración, no de integración, y bloquearía la spec.
- **No:** ignorar el PNG y pintar la fruta como un núcleo magenta. Habría ahorrado 585 KB de asset, pero tira el material que el usuario aportó expresamente.
- **Sí:** una especie de fruta al azar entre las 22, todas valiendo 10 puntos. La variedad es puramente visual y no obliga a mantener una tabla de puntos ni a explicarla en la ficha.
- **Sí:** muros mortales. Es la regla del Snake de Nokia y la que hace que la rejilla se estreche a medida que la serpiente crece.
- **No:** bordes que envuelven. Más indulgente, pero elimina la mitad de la tensión del juego.
- **Sí:** rejilla cuadrada de 24×24 sobre un canvas de 600×600. `object-fit: contain` la encaja con bandas laterales sin deformarla, igual que hace con los 300×600 de Caída.
- **Sí:** cola de giros de dos posiciones. Es la solución estándar al fallo clásico de los Snake escritos con una sola variable de dirección.
- **Sí:** acumulador de tiempo con `dt` acotado, en vez de `setInterval`. Es el patrón de los otros tres motores y evita que una pestaña en segundo plano encadene diez pasos al volver.
- **Sí:** cargador perezoso con la promesa cacheada a nivel de módulo, y `null` en error. Cumple el invariante de que importar no tiene efectos y sobrevive al doble montaje del Strict Mode, exactamente como `loadSpritesheet` en Arkanoid.
- **Sí:** reutilizar la ficha `serpentina` con su `id` intacto. No hay filas en `scores` ni ninguna razón para renombrarla, así que esta spec no trae migración.
- **Sí:** reescribir `short` y `long` de la ficha. Los textos actuales prometen "núcleos magenta" y no mencionan vidas: describirían un juego que no es el que se implementa.
- **Sí:** rehacer `.cover-snake`. La portada actual dibuja el objetivo como un punto magenta; con frutas en el juego, la portada debe leerse igual que la partida.
- **Sí:** dejar el audio fuera, como en las tres specs anteriores. El sonido merece una spec propia que cubra los cuatro juegos a la vez.
- **Sí:** cuatro botones en la fila de dirección, sin tocar `components/player.module.css`. Suman 308 px de ancho y caben en 375 px; una cruceta en dos filas es rediseño del mando y afectaría a los otros tres juegos.

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tocar `GameAction` y `STEERING` rompe el mando táctil de Asteroides, Caída o Arkanoid                          | Solo se **añade** un valor; ninguno de los tres lo declara en sus `actions`, y hay un criterio de aceptación que compara sus mandos antes y después.                                                   |
| La fila de cuatro botones desborda en pantallas estrechas                                                      | 4×60 px + 3×12 px de `gap` + 32 px de `padding` = 308 px, con margen sobre los 375 px del criterio. Se verifica en el emulador de móvil.                                                               |
| Los recortes del atlas no coinciden con el PNG y las frutas salen cortadas                                     | Las coordenadas se copian literalmente de `sprites.js`, que las declara medidas por análisis de píxeles. El paso 1 abre la lámina en el navegador y el criterio exige verlas centradas y sin deformar. |
| El PNG de 585 KB penaliza la entrada al reproductor                                                            | Solo viaja al entrar en `/juegos/serpentina/jugar`, nunca en `/` ni en `/juegos`; la carga es perezosa y la partida arranca aunque la lámina aún no esté, con la fruta dibujada como cuadro liso.      |
| Una pausa larga acumula tiempo y la serpiente da varios pasos de golpe al reanudar                             | La bandera `paused` salta el `update` entero, y el `dt` se acota antes de entrar en el acumulador. Hay un criterio de aceptación específico para la pausa larga.                                       |
| Pulsar dos flechas en el mismo tick invierte el rumbo y mata al jugador sin que entienda por qué               | La cola de giros consume una dirección por paso y descarta al encolar cualquier giro de 180º respecto a la dirección vigente. Criterio de aceptación explícito.                                        |
| Buscar una celda libre para la fruta por sorteo se vuelve lento cuando la serpiente ocupa casi toda la rejilla | Se sortea sobre la lista de celdas libres, no por reintentos. Con 576 celdas el coste es irrelevante en cualquier caso.                                                                                |
| El Strict Mode monta el efecto dos veces y quedan dos bucles o dos descargas del PNG                           | La promesa del cargador está cacheada a nivel de módulo y `destroy()` cancela el `rAF` por su id, es idempotente y retira los listeners de teclado.                                                    |

## Lo que no entra en esta spec

Ni audio, ni obstáculos, ni récord local, ni validación de la puntuación en servidor, ni dificultad seleccionable, ni sprites para la serpiente, ni frutas con valores distintos según especie. Tampoco se conectan `best` y `plays` a la base de datos, ni se retira la maqueta de los juegos que siguen sin motor, ni se toca `references/`.
