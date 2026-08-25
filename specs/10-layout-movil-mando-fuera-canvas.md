# SPEC 10 — Layout móvil del reproductor: mando fuera del canvas

> **Estado:** Implementado
> **Depende de:** SPEC 09
> **Fecha:** 2026-08-24 · **Implementada:** 2026-08-25
> **Objetivo:** Reorganizar el reproductor en dispositivos táctiles como cuatro bloques apilados —datos, pantalla CRT limpia, mando en su propio cuadro fuera del canvas y fila `⏸ FIN SALIR SKIN` abajo—, sin tocar la vista de escritorio.

## Por qué existe esta spec

La SPEC 09 arregló la forma del mando —cruceta con celdas vacías, acciones a la derecha— pero lo dejó donde estaba: **superpuesto al canvas**, en la franja inferior de `.crt-screen`. En un móvil eso significa que la cruceta 3×3 tapa el tercio bajo del área de juego, justo donde en Arkanoid vive la pala y en Caída se apilan las piezas. El fondo semitransparente deja ver, pero el dedo no: la mano cubre lo que hay debajo.

Al mismo tiempo, el HUD superior mete cuatro datos y cuatro controles en una sola barra que en estrecho envuelve en dos o tres líneas, y el bisel de la leyenda de teclado (`ControlPanel`) sigue anunciando `A / D`, `ESPACIO` o `P / ESC` en una pantalla donde no hay teclado.

La reorganización es la misma que tiene una recreativa de sobremesa: pantalla arriba, mando debajo de la pantalla, y los interruptores de servicio en el borde. Cuatro bloques, uno detrás de otro:

1. **Datos** — `Puntuación`, `Vidas`, `Nivel` (en táctil, sin `Jugador`).
2. **Pantalla CRT** — solo el juego (y los avisos de estado que ya pinta).
3. **Mando** — cruceta y acciones, en su propio cuadro.
4. **Servicio** — `⏸`, `FIN`, `SALIR` y, en su propia línea, `SKIN`.

En escritorio no cambia nada de lo que se ve hoy.

> **Aviso de versión.** No se introduce ninguna API de Next. Todo el cambio vive en un componente cliente ya existente y en CSS. Consultar `node_modules/next/dist/docs/` antes de tocar routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Una sola condición para todo el cambio: `@media (pointer: coarse)`.** El apilado en cuatro bloques, la aparición del mando, el apretado del HUD y la desaparición de la leyenda de teclado se activan con la misma media query. Una ventana de escritorio estrecha no cambia de layout: sigue con la barra HUD de hoy, sin mando y con la leyenda visible, porque ahí el teclado funciona.

- **`hud-actions` sale de `player-hud` en el JSX** y pasa a ser el último hijo de `.av-player`, después del CRT, del mando y del bisel. El orden del DOM es ya el orden de lectura en táctil: nada se reordena visualmente respecto al foco.

- **`.av-player` pasa a rejilla** en `app/globals.css`, con áreas:

  ```
  /* escritorio (pointer fino) */
  grid-template-areas:
    "hud     actions"
    "screen  screen "
    "pad     pad    "
    "panel   panel  ";
  grid-template-columns: 1fr auto;

  /* @media (pointer: coarse) */
  grid-template-areas:
    "hud"
    "screen"
    "pad"
    "actions";
  grid-template-columns: 1fr;
  ```

  En escritorio, `.player-hud` (área `hud`) y `.hud-actions` (área `actions`) comparten fila con `gap: 0` y la junta suprimida (`border-right: 0` en `.player-hud`, `border-left: 0` en `.hud-actions`), de modo que las dos cajas se leen como la única barra de hoy: mismo borde, mismo fondo `var(--bg-2)`, mismo `padding: 14px 18px` y misma altura, que la rejilla iguala sola. En táctil cada caja recupera su borde y la fila de servicio cambia su `margin-bottom` por `margin-top: 14px`.

- **Clase para el grupo de datos.** El `<div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>` que envuelve los cuatro `hud-stat` deja de llevar estilo en línea y pasa a `.hud-stats` en `app/globals.css`, con las mismas propiedades. Sin esto, `.player-hud` no tiene un hijo al que dar el marco cuando la fila se parte.

- **El HUD táctil se aprieta a una sola línea.** Cuatro bloques apilados no caben en un móvil corto, y la barra de datos es lo más barato de encoger. En `@media (pointer: coarse)`: el campo `Jugador` no se pinta (`.hud-stat.player { display: none }`, con la clase `player` añadida en el JSX) porque el nombre ya lo sabe quien juega y era lo único que obligaba a envolver la fila; `.hud-stats` ocupa el ancho completo con `nowrap`, `space-between` y `gap: 12px`; cada `.hud-stat` pasa a `flex-direction: row` con `align-items: baseline`, así que rótulo y valor van en la misma línea, con el valor a 13 px; y los espacios se recortan (`.player-hud` a `padding: 8px 12px` y `margin-bottom: 12px`, `.av-player` a `margin-top: 8px`, que sube el reproductor a tocar la cabecera).

- **El mando sale del canvas.** `<TouchPad />` deja de estar dentro de `.crt-screen` y pasa a ser hermano de `.crt`, en el área `pad`. `.touchPad` deja de ser `position: absolute` y se convierte en un bloque normal.

- **El cuadro del mando habla el idioma de la plancha**, como el `ControlPanel` al que sustituye en táctil: borde `var(--line-2)`, labio superior iluminado (`border-top-color: rgba(255,255,255,0.12)`), fondo `linear-gradient(180deg, var(--bg-2), var(--bg))`, `margin-top: 10px` y `padding: 11px`.

- **Mando más pequeño y más junto.** Al no competir con el canvas, las dos zonas dejan de repartirse el ancho a mitades (`flex: 1`): el conjunto se centra y la separación es fija, de 17 px. Los botones bajan de 60 a **42 px** —`.touchBtn` y `.touchSlot`, con el glifo a `font-size: 10px`—, la cruceta cierra a `gap: 4px` (antes 8) y las acciones a `gap: 8px`. La forma redonda, los colores y el reparto de celdas de la SPEC 09 no cambian.

- **El mando está siempre visible, y se apaga cuando no se juega.** Se pinta en cuanto el motor ha cargado (`meta != null`), no solo con `status === "playing"`. Cargando, en pausa y con el modal de fin abierto, los botones van `disabled` y atenuados (`opacity: 0.35`); el bloque conserva su altura, así que el CRT y la fila de servicio no se mueven de sitio al pausar.

- **Soltar lo pulsado al apagarse.** `TouchPad` recibe una prop `disabled` y lleva en un `useRef<Set<GameAction>>` el conjunto de acciones con el dedo encima; cuando `disabled` pasa a `true`, emite `onInput(action, false)` por cada una. Sin esto, pausar con el dedo apoyado dejaría la tecla pegada al reanudar. Para que esa cuenta viva en `TouchPad` y no en el render de cada botón, el botón se extrae a su propio componente `TouchButton`, que recibe `disabled` y un `onPress` estable.

- **El selector de skin, al final de la fila de servicio.** En el JSX pasa de primero a último, detrás de `⏸ FIN SALIR`, y en `@media (max-width: 640px)` `.skinField` lleva `flex-basis: 100%`: se queda con su línea entera y deja los tres botones juntos arriba, en vez de empujar a `SALIR` solo a la segunda fila.

- **La leyenda de teclado desaparece en táctil.** `ControlPanel` no se elimina ni se condiciona en JS: se oculta por CSS en `@media (pointer: coarse)`. En escritorio queda exactamente igual, incluida la línea amarilla de pausa de la plataforma.

**Fuera (otra spec si llega):**

- **El contrato `GameEngine`.** No se toca `lib/engines/types.ts` ni ningún motor: `GameAction`, `actions`, `setInput`, `skins` y los invariantes quedan igual. Es un cambio de presentación del reproductor.
- **El reparto de la cruceta.** `DPAD_SLOT`, `DPAD_ORDER`, `splitActions` y `ACTION_FACE` se quedan como los dejó la SPEC 09. Esta spec mueve el mando de sitio y lo encoge, no cambia qué botón hace qué.
- **Los overlays de estado del CRT.** `CARGANDO…` y `EN PAUSA` siguen dentro de `.crt-screen`: son estados de la pantalla, no controles. "Sin nada superpuesto" se refiere solo al mando.
- **Los datos del HUD.** `Puntuación`, `Vidas` y `Nivel` no cambian de formato ni de orden; en táctil solo cambian de caja y de disposición, y `Jugador` no se pinta.
- **La vista de escritorio.** Ni el HUD, ni el CRT, ni el bisel, ni el modal de fin cambian con puntero fino.
- **El selector de skins** y su persistencia en `localStorage`: intactos. En táctil viaja con la fila de servicio al pie, sin cambiar de comportamiento.
- **Landscape.** No hay distribución alternativa para móvil apaisado; el apilado es el mismo.
- Háptica, gestos, joystick analógico, mando remapeable o reposicionable.
- Audio: sigue pendiente de su spec transversal para los cuatro motores.
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

No hay modelo de datos nuevo: ni tablas, ni columnas, ni migración, ni claves de `localStorage`. Lo único que se añade en código es la prop `disabled` de `TouchPad` y el `useRef` con las acciones pulsadas, descritos en el alcance.

## Plan de implementación

Cada paso deja la aplicación funcionando y se puede parar ahí. Así se hizo:

1. **Rejilla del reproductor.** En `app/globals.css`, convertir `.av-player` en rejilla con las áreas de escritorio, dar `.hud-stats` (sustituyendo el estilo en línea del JSX) y asignar áreas a `.player-hud`, `.crt`, `.touchPad`, `.panel` y `.hud-actions`. Todavía sin mover nada en el JSX: la vista queda idéntica a la de antes en las dos anchuras.
2. **Sacar la fila de servicio.** En `components/game-player.tsx`, mover el bloque `hud-actions` fuera de `player-hud`, al final de `.av-player`. Ajustar en CSS el borde y el `padding` de `.hud-actions` y `.player-hud` para que en escritorio la junta no se vea. Sigue sin haber media query táctil: escritorio idéntico.
3. **Sacar el mando.** Mover `<TouchPad />` fuera de `.crt-screen`, al área `pad`. En `components/player.module.css`, quitar el `position: absolute` de `.touchPad`, darle el marco de plancha (`margin-top: 10px`, `padding: 11px`), centrar las dos zonas con `gap: 17px` y bajar los botones a 42 px, con `gap: 4px` en la cruceta y `8px` en las acciones. El mando queda ya bajo el CRT en dispositivos táctiles.
4. **Estados del mando.** Pintar `TouchPad` con `meta != null` en lugar de `status === "playing"`, pasarle `disabled={status !== "playing"}`, extraer `TouchButton`, aplicar `disabled` a cada botón, añadir el estilo atenuado y soltar en el efecto las acciones que quedasen pulsadas.
5. **Apilado táctil, HUD apretado y leyenda.** Añadir el bloque `@media (pointer: coarse)` con las áreas apiladas, los bordes de cada caja, el HUD de una línea sin `Jugador` y `.panel { display: none }`. Mover el selector de skin al final de `hud-actions` y darle `flex-basis: 100%` en estrecho.
6. **Verificación.** `npm run lint`, `npm run build` y repaso visual con emulación móvil, en un móvil real y en escritorio, en los cuatro juegos con motor y en uno de maqueta.

## Criterios de aceptación

- [x] En emulación móvil, el reproductor se lee de arriba abajo como: datos → pantalla CRT → mando → `⏸ FIN SALIR` → `SKIN`.
- [x] Ningún botón del mando se superpone al canvas: la pantalla CRT enseña solo el juego y, si toca, los avisos `CARGANDO…` o `EN PAUSA`.
- [x] El mando vive en un cuadro con el mismo aspecto de plancha que el bisel de la leyenda (borde, degradado y labio superior iluminado).
- [x] Cruceta y botones de acción quedan centrados y juntos, sin repartirse el ancho de la pantalla a mitades; los botones miden 42 px y conservan su forma redonda y su reparto de celdas.
- [x] Al pausar, el CRT y la fila de servicio no se desplazan: el bloque del mando conserva su altura y sus botones se ven atenuados.
- [x] Con el juego en pausa o con el modal de fin abierto, pulsar un botón del mando no mueve nada en el canvas.
- [x] Mantener pulsada una dirección y pausar en ese momento no deja la acción pegada: al reanudar, el jugador no se mueve solo.
- [x] En táctil, la leyenda de teclado bajo el CRT no se pinta.
- [x] En táctil, la barra de datos ocupa una sola línea: `Puntuación`, `Vidas` y `Nivel`, cada rótulo junto a su valor, sin el campo `Jugador`.
- [x] En un navegador de escritorio (`pointer: fine`), el HUD superior se ve exactamente como antes: datos a la izquierda y los controles a la derecha, en la misma barra y sin junta visible entre las dos mitades.
- [x] En escritorio, el mando no se pinta y la leyenda de teclado sigue bajo el CRT, con la pausa en amarillo.
- [x] En escritorio con la ventana estrecha (< 640 px, puntero fino) el layout no se apila: no aparece mando ni se oculta la leyenda.
- [x] Con puntero grueso, jugando a `serpentina`, la cruceta sigue siendo `▲ ◀ ▶ ▼` con el centro vacío; en `caida` la celda superior sigue vacía y `◀ ▶` no se desplazan.
- [x] El orden de tabulación coincide con el orden visual en las dos vistas.
- [x] Ningún archivo de `lib/engines/` cambia.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Una sola media query, `pointer: coarse`, para todo** —layout apilado, mando, HUD apretado y leyenda— frente a mezclar `max-width: 640px` para el apilado y `pointer: coarse` para el mando. Mezclarlas abría cuatro combinaciones y una incoherente: una tableta táctil de 900 px habría enseñado mando dentro de la barra de escritorio. Con una sola condición hay dos vistas y ya está. La excepción es `.skinField`, que sí usa `max-width: 640px`: ahí lo que manda es el ancho disponible en la fila, no el tipo de puntero.
- **Mover `hud-actions` en el JSX, no reordenar con `order`** — `order` habría sido más barato, pero deja el orden visual y el de foco desacoplados, y el bloque que se movía era justo el de los botones. Con la fila al final del DOM, el orden táctil es el natural y en escritorio la rejilla la sube.
- **Dos cajas pegadas en escritorio en lugar de una barra** — al salir `hud-actions` de `.player-hud`, la barra superior pasa a ser dos ítems de rejilla contiguos con `gap: 0` y sin junta. Se descartó duplicar el marcado (dos copias de los mismos botones, con su estado y sus etiquetas) y usar `display: contents` en `.player-hud` (que habría dejado el bloque de datos sin marco propio en táctil).
- **Mando siempre visible, apagado cuando no se juega** — frente a ocultarlo como hacía la SPEC 09. Superpuesto al canvas, ocultarlo no costaba nada; fuera del canvas, cada pausa daría un salto que mueve el CRT y la fila de servicio bajo el dedo. Un botón atenuado y `disabled` dice lo mismo sin mover la página.
- **Los avisos de estado se quedan dentro del CRT** — `CARGANDO…` y `EN PAUSA` no son controles: son lo que la pantalla está enseñando. Sacarlos habría convertido el cambio de sitio del mando en un rediseño del reproductor entero.
- **La leyenda se oculta por CSS, no por JS** — condicionarla en el componente habría metido en `game-player.tsx` una lectura de `matchMedia` con su estado y su hidratación; ocultarla en la hoja de estilos no tiene ese coste y el marcado sigue ahí para quien conecte un teclado.
- **Botones a 42 px, no a 60** — la spec nació planeando conservar los 60 px de la SPEC 09 y limitarse a apretar los huecos. En el móvil real no cabía: con cuatro bloques apilados, el mando quedaba por debajo del pliegue. Se aplicó la palanca prevista en los riesgos —encoger mando y HUD antes que el canvas— y a 42 px la cruceta y las acciones caben holgadas en pantallas de 360 px sin estirarse a los extremos.
- **Ocultar `Jugador` en táctil** — es el único dato del HUD que no cambia durante la partida y el más largo, así que era el que obligaba a la barra a envolver en dos líneas. Quien juega ya sabe cómo se llama; el nombre sigue en el modal de fin y en el Salón de la Fama.
- **El selector de skin al final de la fila** — puesto delante, en estrecho empujaba a `SALIR` solo a una segunda línea y dejaba la fila descuadrada. Al final y con `flex-basis: 100%`, `⏸ FIN SALIR` quedan juntos y `SKIN` toma su propia línea, que además es lo que menos se toca durante una partida.
- **Sin tocar el contrato ni el reparto de acciones** — esta spec es puro layout. `DPAD_SLOT` y compañía siguen decidiendo qué botón va en qué celda.

## Riesgos identificados

- **Altura total en móviles cortos.** _Se materializó._ Cuatro bloques apilados más un CRT en 4:3 no cabían de una vez. Se aplicó la palanca prevista, sin tocar el canvas ni volver a superponer: mando a 42 px con huecos y `padding` recortados, y HUD táctil de una sola línea sin `Jugador`, con el reproductor subido a `margin-top: 8px`.
- **Salto al terminar de cargar el motor.** El bloque del mando aparece cuando llega `meta`, no antes; en una conexión lenta el CRT se desplaza hacia arriba en ese momento. Se acepta: el `import()` de los motores es local y la ventana es de milisegundos. Si molesta, reservar altura durante `loading` es un cambio de una línea.
- **La junta de la barra de escritorio.** Dos cajas contiguas pueden delatarse por un píxel de borde o por un desajuste de altura si una de las dos crece. La rejilla iguala alturas de fila, pero conviene mirarlo con el HUD sin `Vidas` (Caída y Serpentina) y con el selector de skin presente y ausente.
- **Teclas pegadas al deshabilitar.** El navegador no garantiza un `pointerup` sobre un botón que acaba de volverse `disabled`. El efecto que suelta las acciones pulsadas cubre el caso, pero es el punto que hay que probar a mano en los cuatro juegos: pulsar dirección, pausar sin levantar el dedo, reanudar.
