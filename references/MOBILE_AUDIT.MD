# Auditoría móvil

Memoria del agente `mobile-porter`. Solo navegador móvil: sin PWA ni app nativa.

## Breakpoints canónicos

Estos son los cortes que ya existen en el repo. **Reusarlos.** Añadir uno nuevo exige
justificarlo en la spec y anotarlo aquí.

| Corte                          | Uso                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `max-width: 480px`             | Tabla del Salón muy apretada (`globals.css:1955`)                                                     |
| `max-width: 600px`             | Home: bloque de decoración (`home.module.css:219`)                                                    |
| `max-width: 640px`             | Reproductor: `.panelItem` a dos columnas y `.skinField` a línea entera (`player.module.css:118, 301`) |
| `max-width: 720px`             | Padding lateral global de todas las vistas + tabla del Salón (`globals.css:1864`); about (`365`)      |
| `max-width: 820px`             | About: rejilla principal (`about.module.css:50`)                                                      |
| `max-width: 840px`             | Nav: hamburguesa y panel móvil (`globals.css:317`)                                                    |
| `max-width: 900px`             | Detalle de juego a una columna (`globals.css:1001`); about (`about.module.css:152`)                   |
| `max-width: 1100px`            | Home: rejilla ancha (`home.module.css:214`)                                                           |
| `pointer: coarse`              | **Todo lo táctil**: layout del reproductor, mando, HUD apretado, leyenda de teclado (SPEC 10)          |
| `prefers-reduced-motion`       | Animaciones de home y about                                                                            |

Regla heredada de la SPEC 10: **una sola condición por cambio**. `pointer: coarse` para lo
que depende del dedo; un `max-width` canónico para lo que depende del ancho. Mezclar solo
con justificación escrita (como hizo la SPEC 10 con `.skinField`).

## Estado por pantalla

| Ruta                    | Fecha      | Veredicto                     | Spec    | Notas                                                                                                                   |
| ----------------------- | ---------- | ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/juegos/ranaria`       | 2026-08-25 | Con hallazgos (molesto)       | SPEC 12 | Sin desborde. Falla la zona táctil del nav (hamburguesa 40×37, sesión 37 alto). Etiquetas Press Start a 9 px, al límite. |
| `/juegos/ranaria/jugar` | 2026-08-25 | Con hallazgos (bloqueante)    | SPEC 12 | Mando bajo el pliegue a 375×667, cruceta descentrada 8,5 px, auto-zoom iOS en el campo del modal y en el selector de skin. |

Pendientes de auditar: `/`, `/juegos`, `/salon`, `/acerca`, `/acceso` y los otros cuatro
detalles/reproductores (`asteroides`, `caida`, `arkanoid`, `serpentina`).

Deudas ya localizadas por lectura de CSS, sin auditar en pantalla todavía:

- `home.module.css:11` usa `calc(100vh - 60px)` — único `100vh` del repo; `100dvh` es el arreglo.
- `hall.module.css` y `auth.module.css` no tienen **ninguna** media query.
- `.hall-table` son cuatro columnas fijas que aprietan a 720 y 480 px, sin colapsar ni ofrecer scroll.
- `.av-search input` a 13 px y `.field input` heredando 14 px → auto-zoom de iOS.
- `.av-grid` es `minmax(280px, 1fr)`: a 375 px con 16 de padding quedan 343 y la tarjeta va justa.

## Decisiones tomadas

- **2026-08-25 — Medir con un iframe de 375×667, no con `resize_window`.** La ventana de
  Chrome estaba maximizada y `resize_window` devolvía éxito sin cambiar el viewport (tres
  intentos, `innerWidth` seguía en 1745). Se midió con un `<iframe>` de 375 px de ancho
  sobre el mismo origen: las media queries de anchura sí responden al viewport del iframe.
  Ancho efectivo 358 px por la barra de scroll — algo peor que el móvil real, sirve de caso peor.
- **2026-08-25 — `pointer: coarse` no se puede emular.** Ni redimensionando ni con iframe. La
  vista táctil se comprobó inyectando en el iframe una copia de las reglas del bloque
  `@media (pointer: coarse)` sin el envoltorio, y contrastando siempre contra el CSS fuente.
  Las medidas de esa vista son estimaciones fiables de layout, no capturas de un teléfono.
- **2026-08-25 — El auto-zoom de iOS se arregla subiendo el `font-size` a 16 px, nunca con
  `user-scalable=no`.** Bloquear el zoom quita accesibilidad para tapar la causa.
- **2026-08-25 — Los botones del mando se quedan en 42 px** aunque la checklist pida 44. La
  SPEC 10 los midió para que la cruceta cupiese; son círculos aislados, no vecinos de otros
  objetivos. Excepción consciente, no olvido.
- **2026-08-25 — El aspecto 4:3 del CRT no se toca desde una spec de un solo juego.**
  `ranaria` es 640×600 y pierde ~20 % del ancho en barras negras, pero cambiarlo afecta a los
  cinco motores: queda apuntado para una spec propia.
