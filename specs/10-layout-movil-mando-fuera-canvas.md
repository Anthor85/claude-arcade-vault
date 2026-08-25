# SPEC 10 — Layout móvil del reproductor: mando fuera del canvas

> **Estado:** Aprobado
> **Depende de:** SPEC 09
> **Fecha:** 2026-08-24
> **Objetivo:** Reorganizar el reproductor en dispositivos táctiles como cuatro bloques apilados —datos, pantalla CRT limpia, mando en su propio cuadro fuera del canvas y fila `SKIN ⏸ FIN SALIR` abajo—, sin tocar la vista de escritorio.

## Por qué existe esta spec

La SPEC 09 arregló la forma del mando —cruceta con celdas vacías, acciones a la derecha— pero lo dejó donde estaba: **superpuesto al canvas**, en la franja inferior de `.crt-screen`. En un móvil eso significa que la cruceta 3×3 tapa el tercio bajo del área de juego, justo donde en Arkanoid vive la pala y en Caída se apilan las piezas. El fondo semitransparente deja ver, pero el dedo no: la mano cubre lo que hay debajo.

Al mismo tiempo, el HUD superior mete cuatro datos y cuatro controles en una sola barra que en estrecho envuelve en dos o tres líneas, y el bisel de la leyenda de teclado (`ControlPanel`) sigue anunciando `A / D`, `ESPACIO` o `P / ESC` en una pantalla donde no hay teclado.

La reorganización es la misma que tiene una recreativa de sobremesa: pantalla arriba, mando debajo de la pantalla, y los interruptores de servicio en el borde. Cuatro bloques, uno detrás de otro:

1. **Datos** — `Jugador`, `Puntuación`, `Vidas`, `Nivel`.
2. **Pantalla CRT** — solo el juego (y los avisos de estado que ya pinta).
3. **Mando** — cruceta y acciones, en su propio cuadro.
4. **Servicio** — `SKIN`, `⏸`, `FIN`, `SALIR`.

En escritorio no cambia nada de lo que se ve hoy.

> **Aviso de versión.** No se introduce ninguna API de Next. Todo el cambio vive en un componente cliente ya existente y en CSS. Consultar `node_modules/next/dist/docs/` antes de tocar routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Una sola condición para todo el cambio: `@media (pointer: coarse)`.** El apilado en cuatro bloques, la aparición del mando y la desaparición de la leyenda de teclado se activan con la misma media query. Una ventana de escritorio estrecha no cambia de layout: sigue con la barra HUD de hoy, sin mando y con la leyenda visible, porque ahí el teclado funciona.

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

  En escritorio, `.player-hud` (área `hud`) y `.hud-actions` (área `actions`) comparten fila con `gap: 0` y la junta suprimida (`border-left: 0` en `.hud-actions`), de modo que las dos cajas se leen como la única barra de hoy: mismo borde, mismo fondo `var(--bg-2)`, mismo `padding: 14px 18px` y misma altura, que la rejilla iguala sola.

- **Clase para el grupo de datos.** El `<div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>` que envuelve los cuatro `hud-stat` deja de llevar estilo en línea y pasa a `.hud-stats` en `app/globals.css`, con las mismas propiedades. Sin esto, `.player-hud` no tiene un hijo al que dar el marco cuando la fila se parte.

- **El mando sale del canvas.** `<TouchPad />` deja de estar dentro de `.crt-screen` y pasa a ser hermano de `.crt`, en el área `pad`. `.touchPad` deja de ser `position: absolute` y se convierte en un bloque normal.

- **El cuadro del mando habla el idioma de la plancha**, como el `ControlPanel` al que sustituye en táctil: borde `var(--line-2)`, labio superior iluminado (`border-top-color: rgba(255,255,255,0.12)`), fondo `linear-gradient(180deg, var(--bg-2), var(--bg))` y el mismo `margin-top: 14px`.

- **Botones más juntos.** Al no competir con el canvas, las dos zonas dejan de repartirse el ancho a mitades (`flex: 1`): el conjunto se centra y la separación es fija. Cruceta con `gap: 6px` (antes 8) y separación cruceta ↔ acciones de 24 px. `.touchBtn` conserva sus 60 px, su forma redonda y sus colores; `.touchSlot` sigue midiendo lo mismo que un botón.

- **El mando está siempre visible, y se apaga cuando no se juega.** Se pinta en cuanto el motor ha cargado (`meta != null`), no solo con `status === "playing"`. Cargando, en pausa y con el modal de fin abierto, los botones van `disabled` y atenuados; el bloque conserva su altura, así que el CRT y la fila de servicio no se mueven de sitio al pausar.

- **Soltar lo pulsado al apagarse.** `TouchPad` recibe una prop `disabled` y lleva en un `useRef` el conjunto de acciones con el dedo encima; cuando `disabled` pasa a `true`, emite `onInput(action, false)` por cada una. Sin esto, pausar con el dedo apoyado dejaría la tecla pegada al reanudar.

- **La leyenda de teclado desaparece en táctil.** `ControlPanel` no se elimina ni se condiciona en JS: se oculta por CSS en `@media (pointer: coarse)`. En escritorio queda exactamente igual, incluida la línea amarilla de pausa de la plataforma.

**Fuera (otra spec si llega):**

- **El contrato `GameEngine`.** No se toca `lib/engines/types.ts` ni ningún motor: `GameAction`, `actions`, `setInput`, `skins` y los invariantes quedan igual. Es un cambio de presentación del reproductor.
- **El reparto de la cruceta.** `DPAD_SLOT`, `DPAD_ORDER`, `splitActions` y `ACTION_FACE` se quedan como los dejó la SPEC 09. Esta spec mueve el mando de sitio, no cambia qué botón hace qué.
- **Los overlays de estado del CRT.** `CARGANDO…` y `EN PAUSA` siguen dentro de `.crt-screen`: son estados de la pantalla, no controles. "Sin nada superpuesto" se refiere solo al mando.
- **El contenido del HUD de datos.** `Jugador`, `Puntuación`, `Vidas` y `Nivel` no cambian de formato ni de orden; solo de caja en táctil.
- **La vista de escritorio.** Ni el HUD, ni el CRT, ni el bisel, ni el modal de fin cambian con puntero fino.
- **El selector de skins** y su persistencia en `localStorage`: intactos. En táctil viaja con la fila de servicio al pie, sin cambiar de comportamiento.
- **Landscape.** No hay distribución alternativa para móvil apaisado; el apilado es el mismo.
- Háptica, gestos, joystick analógico, mando remapeable o reposicionable.
- Audio: sigue pendiente de su spec transversal para los cuatro motores.
- Tests automatizados: el proyecto no tiene framework de tests.

## Modelo de datos

No hay modelo de datos nuevo: ni tablas, ni columnas, ni migración, ni claves de `localStorage`. Lo único que se añade en código es la prop `disabled` de `TouchPad` y el `useRef` con las acciones pulsadas, descritos en el alcance.

## Plan de implementación

Cada paso deja la aplicación funcionando y se puede parar ahí.

1. **Rejilla del reproductor.** En `app/globals.css`, convertir `.av-player` en rejilla con las áreas de escritorio, dar `.hud-stats` (sustituyendo el estilo en línea del JSX) y asignar áreas a `.player-hud`, `.crt`, `.touchPad`, `.panel` y `.hud-actions`. Todavía sin mover nada en el JSX: la vista debe quedar idéntica a la de hoy en las dos anchuras.
2. **Sacar la fila de servicio.** En `components/game-player.tsx`, mover el bloque `hud-actions` fuera de `player-hud`, al final de `.av-player`. Ajustar en CSS el borde y el `padding` de `.hud-actions` para que en escritorio la junta con `.player-hud` no se vea. Sigue sin haber media query táctil: escritorio idéntico.
3. **Sacar el mando.** Mover `<TouchPad />` fuera de `.crt-screen`, al área `pad`. En `components/player.module.css`, quitar el `position: absolute` de `.touchPad`, darle el marco de plancha, centrar las dos zonas y apretar los huecos (cruceta `gap: 6px`, separación de 24 px). El mando queda ya bajo el CRT en dispositivos táctiles.
4. **Estados del mando.** Pintar `TouchPad` con `meta != null` en lugar de `status === "playing"`, pasarle `disabled={status !== "playing"}`, aplicar `disabled` a cada botón, añadir el estilo atenuado y soltar en el efecto las acciones que quedasen pulsadas.
5. **Apilado táctil y leyenda.** Añadir el bloque `@media (pointer: coarse)` con las áreas apiladas y `.panel { display: none }`.
6. **Verificación.** `npm run lint`, `npm run build` y repaso visual con emulación móvil y en escritorio, en los cuatro juegos con motor y en uno de maqueta.

## Criterios de aceptación

- [ ] En emulación móvil, el reproductor se lee de arriba abajo como: datos → pantalla CRT → mando → `SKIN ⏸ FIN SALIR`.
- [ ] Ningún botón del mando se superpone al canvas: la pantalla CRT enseña solo el juego y, si toca, los avisos `CARGANDO…` o `EN PAUSA`.
- [ ] El mando vive en un cuadro con el mismo aspecto de plancha que el bisel de la leyenda (borde, degradado y labio superior iluminado).
- [ ] Cruceta y botones de acción quedan centrados y juntos, sin repartirse el ancho de la pantalla a mitades; los botones siguen midiendo 60 px.
- [ ] Al pausar, el CRT y la fila `SKIN ⏸ FIN SALIR` no se desplazan: el bloque del mando conserva su altura y sus botones se ven atenuados.
- [ ] Con el juego en pausa o con el modal de fin abierto, pulsar un botón del mando no mueve nada en el canvas.
- [ ] Mantener pulsada una dirección y pausar en ese momento no deja la acción pegada: al reanudar, el jugador no se mueve solo.
- [ ] En táctil, la leyenda de teclado bajo el CRT no se pinta.
- [ ] En un navegador de escritorio (`pointer: fine`), el HUD superior se ve exactamente como hoy: datos a la izquierda y `SKIN ⏸ FIN SALIR` a la derecha, en la misma barra y sin junta visible entre las dos mitades.
- [ ] En escritorio, el mando no se pinta y la leyenda de teclado sigue bajo el CRT, con la pausa en amarillo.
- [ ] En escritorio con la ventana estrecha (< 640 px, puntero fino) el layout no se apila: no aparece mando ni se oculta la leyenda.
- [ ] Con puntero grueso, jugando a `serpentina`, la cruceta sigue siendo `▲ ◀ ▶ ▼` con el centro vacío; en `caida` la celda superior sigue vacía y `◀ ▶` no se desplazan.
- [ ] El orden de tabulación coincide con el orden visual en las dos vistas.
- [ ] Ningún archivo de `lib/engines/` cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Una sola media query, `pointer: coarse`, para las tres cosas** —layout apilado, mando y leyenda— frente a mezclar `max-width: 640px` para el apilado y `pointer: coarse` para el mando. Mezclarlas abría cuatro combinaciones y una incoherente: una tableta táctil de 900 px habría enseñado mando dentro de la barra de escritorio. Con una sola condición hay dos vistas y ya está.
- **Mover `hud-actions` en el JSX, no reordenar con `order`** — `order` habría sido más barato, pero deja el orden visual y el de foco desacoplados, y el bloque que se movía era justo el de los botones. Con la fila al final del DOM, el orden táctil es el natural y en escritorio la rejilla la sube.
- **Dos cajas pegadas en escritorio en lugar de una barra** — al salir `hud-actions` de `.player-hud`, la barra superior pasa a ser dos ítems de rejilla contiguos con `gap: 0` y sin junta. Se descartó duplicar el marcado (dos copias de los mismos botones, con su estado y sus etiquetas) y usar `display: contents` en `.player-hud` (que habría dejado el bloque de datos sin marco propio en táctil).
- **Mando siempre visible, apagado cuando no se juega** — frente a ocultarlo como hacía la SPEC 09. Superpuesto al canvas, ocultarlo no costaba nada; fuera del canvas, cada pausa daría un salto de ~200 px que mueve el CRT y la fila de servicio bajo el dedo. Un botón atenuado y `disabled` dice lo mismo sin mover la página.
- **Los avisos de estado se quedan dentro del CRT** — `CARGANDO…` y `EN PAUSA` no son controles: son lo que la pantalla está enseñando. Sacarlos habría convertido el cambio de sitio del mando en un rediseño del reproductor entero.
- **La leyenda se oculta por CSS, no por JS** — condicionarla en el componente habría metido en `game-player.tsx` una lectura de `matchMedia` con su estado y su hidratación; ocultarla en la hoja de estilos no tiene ese coste y el marcado sigue ahí para quien conecte un teclado.
- **Botones a 60 px y más juntos** — se descartó agrandarlos a 72 px aprovechando el sitio. La geometría de la SPEC 09 se conserva íntegra; lo único que se aprieta son los huecos, para que la cruceta y las acciones quepan holgadas en pantallas de 360 px sin estirarse a los extremos.
- **Sin tocar el contrato ni el reparto de acciones** — esta spec es puro layout. `DPAD_SLOT` y compañía siguen decidiendo qué botón va en qué celda.

## Riesgos identificados

- **Altura total en móviles cortos.** Cuatro bloques apilados más un CRT en 4:3 pueden no caber en una pantalla de 640 px de alto: el mando quedaría por debajo del pliegue y habría que desplazar para jugar. Es lo primero que hay que medir en el paso 6; si no cabe, la palanca es reducir el `padding` del cuadro del mando y del HUD antes que encoger el canvas o volver a superponer.
- **Salto al terminar de cargar el motor.** El bloque del mando aparece cuando llega `meta`, no antes; en una conexión lenta el CRT se desplaza hacia arriba en ese momento. Se acepta: el `import()` de los motores es local y la ventana es de milisegundos. Si molesta, reservar altura durante `loading` es un cambio de una línea.
- **La junta de la barra de escritorio.** Dos cajas contiguas pueden delatarse por un píxel de borde o por un desajuste de altura si una de las dos crece. La rejilla iguala alturas de fila, pero conviene mirarlo con el HUD sin `Vidas` (Caída y Serpentina) y con el selector de skin presente y ausente.
- **Teclas pegadas al deshabilitar.** El navegador no garantiza un `pointerup` sobre un botón que acaba de volverse `disabled`. El efecto que suelta las acciones pulsadas cubre el caso, pero es el punto que hay que probar a mano en los cuatro juegos: pulsar dirección, pausar sin levantar el dedo, reanudar.
