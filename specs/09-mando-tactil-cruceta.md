# SPEC 09 — Mando táctil en cruceta y fila de botones del HUD

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Fecha:** 2026-08-24
> **Objetivo:** Rehacer el mando táctil del reproductor para que las direcciones se pinten como una cruceta —solo las que el juego declara— con uno o dos botones de acción a su derecha, y arreglar el envoltorio de la fila de botones del HUD en pantalla estrecha.

## Por qué existe esta spec

En un móvil, el mando táctil que pinta `components/game-player.tsx` reparte todos los botones en **una única fila plana** de lado a lado del canvas: `.touchPad` usa `justify-content: space-between` y sus dos `.touchGroup` colocan los botones en línea. En Serpentina eso produce `◀ ▲ ▼ ▶` en horizontal, cuatro círculos separados que ocupan todo el ancho de la pantalla CRT y no guardan ninguna relación espacial con lo que hacen: para ir hacia arriba hay que pulsar el segundo círculo empezando por la izquierda. Un mando de recreativa no se lee así.

El reparto conceptual sí existe ya —`STEERING` separa dirección de acción—, pero es una lista plana de cuatro valores, no una rejilla, y `thrust` de Asteroides queda fuera de ella pese a ser una dirección de hecho: el jugador lo percibe como "arriba".

Aparte, la fila de acciones del HUD (`.hud-actions`) envuelve mal en estrecho: `SKIN`, `⏸` y `FIN` llenan la primera línea y `SALIR` cae solo a la segunda, desalineado y con el botón menos importante ocupando una fila entera.

Los tachones rojos de la captura sobre `Jugador`, `Puntuación`, `Vidas` y `Nivel` **no forman parte de esta spec**: esos campos se quedan como están.

> **Aviso de versión.** No se introduce ninguna API de Next. Todo el cambio vive en un componente cliente ya existente y en CSS. Consultar `node_modules/next/dist/docs/` antes de tocar routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Reparto de acciones por celda.** Nueva constante `DPAD_SLOT` en `components/game-player.tsx`, que traduce una `GameAction` a la celda de la cruceta que ocupa:

  ```ts
  /** Acciones que el jugador percibe como dirección, y celda que ocupan. */
  const DPAD_SLOT: Partial<
    Record<GameAction, "up" | "down" | "left" | "right">
  > = {
    up: "up",
    thrust: "up",
    down: "down",
    left: "left",
    right: "right",
  };
  ```

  Lo que no tiene celda (`fire`, `rotate`, `drop`) va al grupo de acciones. Regla de precedencia, escrita aunque hoy ningún motor la active: si un motor declarase a la vez `up` y `thrust`, la celda superior es para `up` y `thrust` baja al grupo de acciones.
  Esta constante **sustituye a `STEERING`**, que se elimina.

- **`TouchPad` reescrito** en `components/game-player.tsx`. Pinta dos zonas:
  - una **cruceta** de 3×3 con las celdas `up`, `left`, `right`, `down`; las direcciones que el motor no declara dejan su celda **vacía**, no colapsada, para que las que sí existen conserven su sitio;
  - un **grupo de acciones** a la derecha, con uno o dos botones según el motor.

  Se conserva íntegro el manejo de punteros actual: `onPointerDown/Up/Cancel/Leave` con `preventDefault`, `onContextMenu` bloqueado, y `setInput(action, down)` como único camino de entrada. El glifo y el nombre accesible siguen saliendo de `ACTION_FACE`.

- **CSS del mando** en `components/player.module.css`: `.touchPad` mantiene su posición (franja inferior del canvas, `position: absolute` con `bottom: 0`) y su `@media (pointer: coarse)`; dentro reparte cruceta a la izquierda y acciones a la derecha, cada grupo centrado en su mitad. Se añaden `.touchDpad` (rejilla 3×3 por `grid-template-areas`), `.touchSlot` (hueco vacío del mismo tamaño que un botón) y `.touchActions`. `.touchBtn` y `.touchFire` conservan tamaño, forma y estética.

- **Fila de botones del HUD**: en `@media (max-width: 640px)`, el selector de skin ocupa línea completa y `⏸`, `FIN` y `SALIR` van juntos en la línea de abajo, en ese orden. El orden del marcado ya es skin → pausa → fin → salir, así que solo hay que forzar el salto; no se reordena JSX.

- **Comprobación en los cuatro motores con mando**, con el reparto resultante:

  | Juego        | `actions` declaradas     | Cruceta | Acciones    |
  | ------------ | ------------------------ | ------- | ----------- |
  | `serpentina` | `left up down right`     | ◀ ▲ ▼ ▶ | — (ninguna) |
  | `asteroides` | `left right thrust fire` | ◀ ▲ ▶   | ● disparar  |
  | `caida`      | `left right down rotate` | ◀ ▼ ▶   | ⟳ rotar     |
  | `arkanoid`   | `left right fire`        | ◀ ▶     | ● disparar  |

**Fuera (otra spec si llega):**

- **El contrato `GameEngine`.** No se toca `lib/engines/types.ts` ni ningún motor: `GameAction`, `actions`, `setInput` y los invariantes quedan exactamente igual. Este cambio es solo de presentación del reproductor.
- **Acciones nuevas.** `drop` sigue declarado en el contrato y sin usar por ningún motor; no se le busca sitio.
- **HUD de datos.** `Jugador`, `Puntuación`, `Vidas` y `Nivel` no cambian ni de sitio ni de formato.
- **Leyenda de teclado** bajo el marco CRT (`ControlPanel`): intacta, incluida la línea de pausa de la plataforma.
- **Selector de skins** y su persistencia en `localStorage`: intactos.
- **Visibilidad del mando.** Sigue apareciendo solo con `status === "playing"` y bajo `@media (pointer: coarse)`. No se pinta en pausa, ni cargando, ni en fin de partida, ni en escritorio.
- Háptica, gestos de deslizamiento, joystick analógico, mando reposicionable o remapeable, y mando en horizontal (landscape) con distribución distinta.
- Audio: sigue pendiente de su spec transversal para los cuatro motores.
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

No hay modelo de datos nuevo: ni tablas, ni columnas, ni migración, ni claves de `localStorage`. Lo único que se introduce es la constante de reparto `DPAD_SLOT`, ya descrita en el alcance.

## Plan de implementación

Cada paso deja la aplicación funcionando y se puede parar ahí.

1. **Reparto.** En `components/game-player.tsx`, sustituir `STEERING` por `DPAD_SLOT` y cambiar el filtro de `TouchPad` para que use el mapa: dirección = tiene celda, acción = no la tiene. Todavía sin tocar CSS: el mando se sigue viendo en fila, pero Asteroides ya clasifica `thrust` como dirección y su grupo de acciones baja a un solo botón.
2. **Marcado.** Reescribir el JSX de `TouchPad` en las dos zonas: `.touchDpad` con sus cuatro celdas (botón o `.touchSlot` vacío según lo declarado) y `.touchActions` con el resto. Los huecos vacíos llevan `aria-hidden` y no son focusables.
3. **CSS del mando.** Escribir `.touchDpad`, `.touchSlot` y `.touchActions` en `components/player.module.css` y ajustar `.touchPad` para repartir las dos zonas en la franja inferior. Retirar `.touchGroup` si deja de usarse.
4. **HUD.** Ajustar el envoltorio de `.hud-actions` en móvil para que `SKIN` quede en su línea y `⏸ FIN SALIR` en la siguiente.
5. **Verificación.** `npm run lint`, `npm run build` y repaso visual con emulación móvil en los cuatro juegos con motor.

## Criterios de aceptación

- [ ] En un dispositivo de puntero grueso, jugando a `serpentina`, las cuatro direcciones se pintan en cruceta: `▲` arriba, `▼` abajo, `◀` y `▶` a los lados de un centro vacío.
- [ ] En `asteroides`, la celda superior de la cruceta es `▲` y pulsarla propulsa la nave (`thrust`), no ejecuta ninguna otra acción.
- [ ] En `caida`, la cruceta tiene `◀ ▼ ▶` y la celda superior queda vacía: `◀` y `▶` no se desplazan de sitio por ese hueco.
- [ ] En `arkanoid`, la cruceta tiene solo `◀ ▶` y a la derecha hay exactamente un botón de acción.
- [ ] En ningún juego actual hay más de dos botones de acción, y siempre quedan a la derecha del canvas.
- [ ] Cruceta y botones de acción están en la franja inferior de la pantalla CRT, cada grupo centrado en su mitad, y no tapan la zona alta de juego.
- [ ] Mantener pulsado un botón produce movimiento continuo, y soltarlo —o sacar el dedo del botón— lo detiene: el comportamiento de `setInput` no cambia respecto a hoy.
- [ ] En un navegador de escritorio (`pointer: fine`), incluso con la ventana estrecha, el mando no se pinta.
- [ ] El mando sigue apareciendo solo con la partida en curso: no se ve cargando, ni en pausa, ni con el modal de fin abierto.
- [ ] En móvil, `SALIR` está en la misma línea que `⏸` y `FIN`, a su derecha, y el selector `SKIN` ocupa la línea de encima.
- [ ] En escritorio ancho, la fila del HUD se sigue viendo en una sola línea, como hasta ahora.
- [ ] Las celdas vacías de la cruceta no son focusables ni las anuncia un lector de pantalla.
- [ ] Ningún archivo de `lib/engines/` cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Mando superpuesto al canvas, en la franja inferior** — frente a centrarlo verticalmente sobre la pantalla o sacarlo fuera del marco CRT. Centrarlo en vertical tapaba la zona de juego; sacarlo fuera obligaba a encoger el canvas, que en móvil ya va justo. La franja inferior es donde el jugador apoya los pulgares y es donde ya estaba.
- **`thrust` ocupa la celda superior de la cruceta** — frente a dejarlo como botón de acción. En Asteroides el jugador lee propulsar como "arriba", y así la cruceta no queda con un hueco arriba y dos botones amontonados a la derecha. Es también el reparto de la recreativa original.
- **Celdas vacías en lugar de cruceta colapsada** — un juego con solo `◀ ▶` conserva la geometría del mando: los dos botones quedan donde estarían si hubiera cuatro. Colapsar movía los botones de sitio de un juego a otro y obligaba a reaprender el mando.
- **El mando se sigue mostrando solo jugando** — se descartó dejarlo visible en pausa. Se valoró para evitar el salto visual al pausar, pero un mando visible e inerte invita a pulsarlo y a pensar que el juego se ha colgado.
- **`SKIN` en su propia línea en móvil** — frente a apilar en dos filas también en escritorio. En ancho los cuatro controles caben de sobra y partirlos sería empeorar la vista que hoy funciona.
- **`DPAD_SLOT` como mapa, no como lista** — `STEERING` era una lista plana: decía qué era dirección, pero no dónde iba. Un mapa acción → celda responde las dos preguntas a la vez y es lo que la cruceta necesita para colocar los botones.
- **Sin tocar el contrato** — se descartó añadir a `GameEngine` un campo que declarase la distribución del mando. El reparto se deduce entero de `actions`, que los motores ya declaran; un campo nuevo sería información duplicada que puede contradecirse.

## Riesgos identificados

- **Espacio vertical en móviles pequeños.** Una cruceta 3×3 es más alta que la fila plana actual: en pantallas cortas puede comerse una parte apreciable del canvas. Mitigación: los botones mantienen su tamaño actual (60 px) y el bloque se ancla abajo; si se queda corto, reducir el tamaño del botón dentro de la franja antes que mover el mando de sitio.
- **La cruceta tapa el juego.** En Serpentina la serpiente puede pasar justo por debajo de los botones. El fondo semitransparente actual (`rgba(10,10,15,0.55)`) ya deja ver lo que hay detrás y esta spec no lo cambia; si estorba, es material para una spec de ajuste, no para esta.
- **Regresión en el arrastre del dedo.** Al pasar de una fila a una rejilla, un dedo que se desliza de un botón a otro atraviesa celdas nuevas. `onPointerLeave` ya suelta la acción al salir, así que no debería quedarse ninguna tecla pegada, pero es lo primero que hay que probar a mano en los cuatro juegos.
