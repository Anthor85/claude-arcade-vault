# SPEC 12 — Ranaria en el móvil: tablero visible, mando centrado y campos sin auto-zoom

> **Estado:** Implementado
> **Depende de:** SPEC 10
> **Fecha:** 2026-08-25
> **Objetivo:** Que en un móvil de 375×667 se vean a la vez el tablero de Ranaria y su cruceta, que la cruceta quede centrada, que ningún campo dispare el zoom de Safari y que nada quede bajo la barra de gestos.

## Por qué existe esta spec

La SPEC 10 sacó el mando del canvas y apiló el reproductor en cuatro bloques. Con `ranaria` —motor de 640×600, cuatro direcciones y ningún botón de acción— aparecen tres cosas que aquella spec no vio:

1. **El conjunto no cabe.** Medido en la vista táctil a 375 px de ancho: nav 60 + HUD 57 + CRT 307 (pantalla de 221 + 48 de bisel + 38 de la tira `SEÑAL OK · … · CARGA`) + mando 158 + fila de servicio 108. El mando termina cerca de los 612 px, por debajo del pliegue de un iPhone SE con la barra de URL abierta (~560 px útiles). En Ranaria eso duele más que en Arkanoid: hay que mirar el carril de arriba y pulsar abajo en la misma mirada.
2. **La cruceta está descentrada.** `.touchPad` reparte `dpad — gap 17px — acciones`. Ranaria declara `actions: ["up","left","right","down"]`, así que `.touchActions` queda **vacío y con ancho 0**: el hueco de 17 px sigue contando y la cruceta se va ~8,5 px a la izquierda del centro del cuadro. Se nota porque la cruceta es simétrica.
3. **Campos que hacen zoom.** El nombre del modal de fin (`.modal .input-row input`) no declara `font-size` y hereda los 14 px del `body`; el selector de skin va a 8 px. Safari hace zoom al enfocar cualquier campo por debajo de 16 px y deja la página descuadrada — justo en el paso de guardar la marca.

A esto se suman dos deudas del sitio que se manifiestan en estas dos rutas: zonas táctiles por debajo de 44 px (hamburguesa 40×37, botón de sesión 37 de alto, `⏸` 46×38, `FIN`/`SALIR` 41 de alto, selector de skin 28) y **cero uso de `env(safe-area-inset-*)`** en el repo, que además hoy no serviría de nada porque no hay `export const viewport` con `viewportFit`.

Todo lo que se propone se activa con **una sola condición por cambio**, como en la SPEC 10: `pointer: coarse` para lo táctil, y sin ningún corte de anchura nuevo.

> **Aviso de versión.** Sí se introduce API de Next: `export const viewport` en `app/layout.tsx` (Metadata API). Consultado en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`: el objeto `viewport` solo se exporta desde Server Components y no puede convivir con `generateViewport` en el mismo segmento; `app/layout.tsx` cumple las dos cosas. El doc **no** documenta `viewportFit`, pero el campo existe en el tipo `Viewport` (`node_modules/next/dist/lib/metadata/types/extra-types.d.ts:52`, valores `auto | cover | contain`). El resto del cambio es CSS.

## Alcance

**Dentro:**

- **`export const viewport` en `app/layout.tsx`**, junto al `metadata` que ya hay:
  `width: "device-width"`, `initialScale: 1`, `viewportFit: "cover"`. Next ya emite el `meta` por defecto; lo único que aporta esta línea es `viewport-fit=cover`, sin el cual `env(safe-area-inset-*)` vale siempre 0. **No** se pone `maximumScale` ni `userScalable: false`: impedir el zoom manual es un problema de accesibilidad y el auto-zoom se arregla por la vía correcta, subiendo el `font-size` de los campos.

- **Campos a 16 px, para que Safari no haga zoom al enfocar.**
  - `.modal .input-row input` (`app/globals.css`): `font-size: 16px` sin media query. El campo ya mide 44 px de alto, así que el texto entra sin retocar nada más, y en escritorio 16 px en un campo de 44 se ve igual de bien que 14. Es el campo de guardar la puntuación: el único formulario del reproductor.
  - `.skinSelect` (`components/player.module.css`), en `@media (pointer: coarse)`: `font-size: 16px`, `letter-spacing: 0`, `min-height: 44px` y `padding` recalculado. Desde la SPEC 10 el selector se lleva su propia línea al pie, así que tiene sitio de sobra. En escritorio sigue con sus 8 px pixelados.

- **Zonas táctiles de 44 px, solo en `@media (pointer: coarse)`.** `min-height: 44px` (y `min-width: 44px` donde el ancho también se queda corto) en: `.av-nav .hamburger` (40×37), `.av-nav .auth-btn` (37 de alto), y los botones de la fila de servicio del reproductor `⏸` (46×38), `FIN` y `SALIR` (41 de alto). Ninguno cambia de aspecto en escritorio. Los botones del mando se quedan en los 42 px que fijó la SPEC 10: son círculos aislados con separación propia, y subirlos rompería el encaje de la cruceta que aquella spec ya midió.

- **Ganar pliegue en el reproductor táctil, sin tocar la vista de escritorio.** En `@media (pointer: coarse)`:
  - `.crt-bottom { display: none }` — la tira `SEÑAL OK · RANARIA · CRT-83 · 60 HZ · CARGA · 1MB` es decoración, va en Press Start 2P a **8 px** (ilegible en pantalla real), a 375 px envuelve en dos líneas y cuesta ~38 px de alto.
  - `.crt { padding: 12px }` (hoy 24) — el bisel gordo es lenguaje de escritorio; a 375 px se come 24 px de ancho que el tablero necesita.
  - Efecto medido/estimado sobre el ejemplo: la pantalla pasa de 278×209 a ~300×225 (celda de Ranaria de 13,9 a ~15 px) y el bloque del CRT baja ~46 px, con lo que el mando entero queda por encima del pliegue en un 375×667 con barra de URL.

- **Cruceta centrada cuando el juego no tiene botones de acción.** `.touchActions:empty { display: none }` en `components/player.module.css`, para que el `gap: 17px` de `.touchPad` no cuente un hueco que no existe. Afecta hoy solo a `ranaria`; el resto de motores declaran al menos una acción.

- **Safe areas en lo fijo y en lo que va al borde**, ya con `viewportFit: "cover"`:
  - `.av-mobile-panel`: `padding-bottom: calc(24px + env(safe-area-inset-bottom))` y `padding-right: calc(20px + env(safe-area-inset-right))`.
  - `.modal-bd`: `padding-bottom: calc(20px + env(safe-area-inset-bottom))`, para que los botones del modal de fin no queden bajo la barra de gestos.
  - `.av-player`, en `@media (pointer: coarse)`: el `padding-bottom` suma `env(safe-area-inset-bottom)`, porque la fila de servicio es lo último de la página.
  - `.av-mobile-backdrop` no necesita nada: es `inset: 0` y no lleva contenido.

**Fuera (otra spec si llega):**

- **La relación de aspecto del CRT.** `.crt-screen` impone 4:3 y `ranaria` es 640×600 (16:15), así que `object-fit: contain` deja ~20 % del ancho en barras negras. El motor ya declara `width`/`height` en `GameEngine`, así que se podría pasar su aspecto al CSS, pero eso cambia el marco de **todos** los juegos y merece su propia spec con su repaso de los cinco motores.
- **El resto del sitio.** `/`, `/juegos`, `/salon`, `/acerca` y `/acceso` no se han auditado en esta pasada: solo `/juegos/ranaria` y `/juegos/ranaria/jugar`. Quedan pendientes en la memoria el `100vh` de `home.module.css:11`, la `.hall-table` de cuatro columnas fijas y los formularios de `/acceso` (`hall.module.css` y `auth.module.css` no tienen ninguna media query).
- **La vista de escritorio** y todo lo que la SPEC 10 dejó cerrado: apilado, HUD de una línea, mando fuera del canvas, orden de la fila de servicio.
- **El motor `lib/engines/ranaria.ts`**, su mecánica, su puntuación, sus skins y el contrato `GameEngine`.
- PWA, manifest, service worker, iconos de instalación, háptica y gestos.
- Audio: sigue pendiente de su spec transversal.

## Modelo de datos

No hay. Ni tablas, ni columnas, ni migración, ni claves de `localStorage`. El único añadido en código que no es CSS es el `export const viewport` de `app/layout.tsx`.

## Plan de implementación

Cada paso deja la aplicación funcionando y se puede parar ahí.

1. **`export const viewport`.** Añadirlo en `app/layout.tsx` con `width`, `initialScale` y `viewportFit: "cover"`, tipado con `import type { Viewport } from "next"`. Verificar en el HTML servido que el `meta` sale con `viewport-fit=cover`. Todavía no cambia nada visible: prepara el terreno para las safe areas.
2. **Campos sin auto-zoom.** `font-size: 16px` en `.modal .input-row input`; bloque `pointer: coarse` para `.skinSelect` con 16 px, `min-height: 44px` y `padding` ajustado. Comprobar en escritorio que el modal y la píldora de skin siguen bien.
3. **Zonas táctiles.** Bloque `pointer: coarse` con los `min-height`/`min-width` de hamburguesa, botón de sesión y `⏸ FIN SALIR`.
4. **Pliegue del reproductor.** En el bloque `pointer: coarse` que ya existe en `app/globals.css`: ocultar `.crt-bottom` y bajar el `padding` de `.crt` a 12 px, con el comentario del porqué (decoración ilegible a 8 px; bisel de escritorio que roba ancho al tablero).
5. **Cruceta centrada.** `.touchActions:empty { display: none }` en `components/player.module.css`, comentado: los juegos que solo declaran direcciones no deben pagar el hueco entre zonas.
6. **Safe areas.** `env(safe-area-inset-*)` en `.av-mobile-panel`, `.modal-bd` y el `padding-bottom` táctil de `.av-player`.
7. **Verificación.** `npm run lint`, `npm run build`, repaso en Chrome de escritorio (que nada cambie) y prueba en un móvil real con `http://192.168.68.107:3000`, jugando una partida completa de Ranaria hasta el modal de fin.

## Criterios de aceptación

- [ ] En un móvil de 375×667 con la barra de URL visible, `/juegos/ranaria/jugar` enseña el tablero completo **y** la cruceta entera sin desplazar la página.
- [ ] La cruceta de Ranaria queda centrada en su cuadro: la distancia del botón `◀` al borde izquierdo del cuadro es la misma que la de `▶` al borde derecho.
- [ ] En los juegos que sí tienen botón de acción (`asteroides`, `arkanoid`, `caida`, `serpentina`), el mando se ve exactamente igual que después de la SPEC 10.
- [ ] La tira `SEÑAL OK · … · CARGA` no se pinta en táctil, y sigue apareciendo en escritorio bajo la pantalla.
- [ ] En Safari de iOS, enfocar el campo de nombre del modal de fin **no** hace zoom ni descuadra el modal.
- [ ] En Safari de iOS, abrir el selector de skin no hace zoom; la píldora `SKIN` mide al menos 44 px de alto y se lee.
- [ ] La página sigue permitiendo el zoom con dos dedos (no se ha puesto `user-scalable=no`).
- [ ] Hamburguesa, botón de sesión y `⏸ FIN SALIR` miden 44 px o más en su lado corto con puntero grueso.
- [ ] En un iPhone con barra de gestos, ni la última entrada del panel de navegación, ni los botones del modal de fin, ni la fila de servicio quedan tapados.
- [ ] `document.documentElement.scrollWidth === clientWidth` en las dos rutas, y ningún elemento visible sobresale del ancho salvo el panel de navegación cerrado (que vive fuera de pantalla por diseño).
- [ ] En Chrome de escritorio, ambas rutas se ven exactamente como antes de esta spec.
- [ ] No se ha añadido ningún corte de anchura nuevo: todos los cambios cuelgan de `pointer: coarse` o no llevan condición.
- [ ] Ningún archivo de `lib/engines/` cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **`viewportFit: "cover"` sí; `userScalable: false` no.** Bloquear el zoom es la receta rápida contra el auto-zoom de iOS y es la peor: quita una ayuda de accesibilidad para tapar un `font-size` mal puesto. Se sube el campo a 16 px, que es la causa real.
- **Los 16 px del campo del modal, sin media query.** Podría condicionarse a `pointer: coarse`, pero el campo mide 44 px de alto y 16 px le sientan bien también en escritorio; una condición menos es una combinación menos que probar. El selector de skin sí va condicionado: ahí 16 px de Press Start 2P cambian de verdad la forma de la píldora, y en escritorio no hace falta.
- **Ocultar `.crt-bottom` en táctil en lugar de encogerlo.** Ya está en el mínimo (8 px) y a ese tamaño no se lee en un teléfono; encogerlo más sería mentir y dejarlo cuesta 38 px de la única dimensión escasa. En escritorio se queda, que es donde el guiño de recreativa se aprecia.
- **Bisel de 12 px en táctil, no de 0.** Quitar el `padding` del `.crt` daría 24 px más de tablero, pero el marco es la identidad visual del reproductor: 12 px conservan el bisel y el `border-radius` y ya devuelven casi todo el ancho.
- **`.touchActions:empty` en vez de condicionarlo en el JSX.** `splitActions` podría no pintar la zona vacía, pero eso mete una rama más en `game-player.tsx` para un caso de CSS puro; `:empty` describe exactamente la condición y no toca el marcado.
- **No se toca la relación de aspecto del CRT.** Es el cambio que más tablero daría en Ranaria (las barras negras se llevan ~20 % del ancho), pero afecta a los cinco motores y a la vista de escritorio, así que va a su propia spec.
- **Los botones del mando siguen a 42 px** pese a la regla de los 44. La SPEC 10 los bajó a propósito para que la cruceta cupiera, son círculos con separación propia y no vecinos de otros objetivos; subirlos reabriría el encaje que aquella spec cerró. Se anota como excepción consciente, no como olvido.
- **Ningún corte de anchura nuevo.** Todo lo táctil cuelga de `pointer: coarse` y los campos no llevan condición: los diez cortes que ya arrastra el repo siguen siendo diez.

## Riesgos identificados

- **`viewport-fit=cover` cambia el lienzo en iOS.** Con `cover`, el `body` pasa a ocupar bajo las barras del sistema. Si algo del sitio da por hecho el recorte anterior, puede aparecer contenido bajo la barra de gestos en pantallas que esta spec no ha auditado (`/`, `/salon`, `/acerca`, `/acceso`). Hay que repasarlas en un móvil real después de este cambio; es el motivo por el que las safe areas van en el mismo lote.
- **La píldora de skin a 16 px.** Press Start 2P duplica su tamaño y la palabra `CLÁSICO` es larga; puede pedir recortar el `letter-spacing` o el `padding` más de lo previsto. Como desde la SPEC 10 tiene su línea entera, hay margen, pero es lo primero que hay que mirar en el móvil real.
- **La estimación del pliegue es de laboratorio.** Las medidas se tomaron en un viewport de 358 px simulando el bloque `pointer: coarse`, porque redimensionar la ventana no emula puntero grueso. La ganancia de ~46 px es fiable; que el mando quepa entero depende del teléfono y de si la barra de URL está desplegada. Si sigue sin caber, la siguiente palanca es el aspecto del CRT, no encoger más el mando.
- **`:empty` es literal.** Si en el futuro `.touchActions` recibe un hijo invisible (un `aria-live`, un separador), la regla deja de aplicarse y la cruceta vuelve a descentrarse sin que nadie lo note.
