# SPEC GJ-RANARIA-A — Ranaria jugable: travesía de rejilla con cinco nenúfares

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 08
> **Fecha:** 2026-08-24
> **Tema:** cruzar sin morir
> **Variante:** A de 2 — rival: `02-ranaria-jugable.md`
> **Objetivo:** Escribir desde cero el motor `lib/engines/ranaria.ts` como un Frogger de rejilla pura —salto discreto de celda, cinco nenúfares que hay que ocupar para cerrar la travesía y cronómetro pintado dentro del canvas— y conectarlo a la ficha `ranaria`, de modo que `/juegos/ranaria/jugar` sea una partida real cuya puntuación se inscribe en el Salón de la Fama.

## Por qué existe esta spec

La plataforma tiene cuatro motores reales: Asteroides (SPEC 05), Caída (SPEC 06), Arkanoid (SPEC 07) y Serpentina (SPEC 08). `ranaria` sigue siendo una ficha de `lib/games.ts` sin motor: entrar en `/juegos/ranaria/jugar` cae en `MockArena`, la maqueta que sube la puntuación sola con un `setInterval`. Se puede guardar en `scores` un número que nadie ha jugado.

Al tema «cruzar sin morir» le aporta el caso literal: el jugador no dispara, no rebota nada y no acumula piezas; solo elige cuándo pisar el hueco. Es también la mecánica más distinta de las cuatro ya jugables — avance por carriles con obstáculos que cruzan la pantalla, sin proyectiles ni pelota.

No hay port: `references/started-games/` no contiene ningún Frogger. La lógica se escribe entera contra el contrato `GameEngine`.

**No hay desajuste con el contrato.** Las cuatro direcciones absolutas (`up`, `down`, `left`, `right`) ya existen en `GameAction` desde la SPEC 08, así que esta spec **no** toca `lib/engines/types.ts` ni `ACTION_FACE` / `STEERING` de `components/game-player.tsx`.

Sí hay un indicador que el HUD del reproductor no sabe mostrar: el **cronómetro de la travesía**. El HUD genérico tiene `Puntuación`, `Vidas` y `Nivel`, y ninguno más. Tal y como anota `references/SUGERENCIAS_JUEGOS.MD`, el cronómetro **se pinta dentro del canvas**, en la franja inferior reservada para ello. Es legal —no es HUD de estado de la plataforma, es parte del tablero del juego— y queda escrito aquí para que nadie lo confunda con un HUD paralelo.

> **Aviso de versión.** No se introduce ninguna API de Next. El motor se carga con el mismo `import()` dinámico dentro del efecto de `components/game-player.tsx` que ya usan los otros cuatro. Consultar `node_modules/next/dist/docs/` antes de tocar cualquier cosa de routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Motor nuevo** en `lib/engines/ranaria.ts`, que exporta `ranariaEngine: GameEngine`: tablero fijo de 13×15 celdas sobre un canvas interno de 520×600, rana que salta de celda en celda, cinco carriles de coches, cinco carriles de río con troncos y tortugas, cinco nenúfares de meta, tres vidas y cronómetro por travesía.
- **Registro** de `ranaria` en `ENGINES` (`lib/engines/index.ts`), con `import()` diferido.
- **Textos de la ficha** `ranaria` en `lib/games.ts`: `short` y `long` reescritos para describir el juego real (nenúfares, cronómetro, tres vidas). El `id` no cambia.
- **Cronómetro y contador de nenúfares** dibujados dentro del canvas, en la franja inferior del tablero.
- Ayuda de controles bajo el marco CRT: las cuatro flechas.
- Todo el arte con primitivas de canvas, en el lenguaje visual neón de la plataforma.

**Fuera (otra spec si llega):**

- **Audio.** Sin salto, sin chapoteo, sin claxon. Los cuatro motores existentes son mudos; el sonido va en una spec transversal que los cubra a todos a la vez.
- **Sprites y lámina de arte.** No hay material en `references/source-assets/` para este juego y encargarlo bloquearía la spec.
- **Portada.** `.cover-rana` de `app/globals.css` ya dibuja carriles horizontales y un cuerpo verde en el centro: describe el juego que se implementa y no se toca.
- Cocodrilos, serpientes, nutrias, la mosca de bonus y la rana rosa que se lleva a cuestas del Frogger original.
- Tortugas que se sumergen: en esta variante la tortuga es una plataforma sólida más, con otra velocidad.
- **Récord local en `localStorage`** y **validación anti-trampas** de la puntuación. Sigue vigente el riesgo asumido en la SPEC 04: la marca la envía el cliente.
- Dificultad seleccionable. Los valores de esta spec son fijos.
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos. Siguen inventados en las nueve fichas.
- Retirar la maqueta de los juegos que aún no tienen motor.
- Realtime en el Salón de la Fama (pendiente desde la SPEC 04).
- Tests automatizados: el proyecto no tiene framework de tests.
- Modificar `references/`. Es material de solo lectura.

## Modelo de datos

No hay tablas nuevas, ni columnas nuevas, **ni migración**. La ficha conserva su `id` (`ranaria`), así que ninguna fila de `scores` cambia de `game_id`.

### Contrato

`lib/engines/types.ts` **no cambia**. El motor declara:

```ts
actions: ["up", "left", "right", "down"];
hasLives: true;
```

`components/game-player.tsx` tampoco cambia: `up`, `down`, `left` y `right` ya están en `ACTION_FACE` y en `STEERING` desde la SPEC 08, así que los cuatro botones caen en el grupo de dirección y el de acción queda vacío. `components/player.module.css` no cambia: cuatro botones de 60 px con `gap: 12px` y `padding: 16px` suman 308 px y caben en 375 px.

### Reglas del juego

| Concepto           | Valor                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas interno     | 520×600 px, rejilla de 13×15 celdas de 40 px                                                                                                                         |
| Filas              | 0 meta con 5 nenúfares · 1–5 río · 6 mediana · 7–11 carretera · 12 orilla de salida · 13–14 franja de estado                                                         |
| Franja de estado   | Dentro del canvas: cronómetro como barra que se vacía, y los 5 nenúfares en miniatura marcando cuáles están ocupados                                                 |
| Salto              | Discreto e instantáneo: una pulsación = una celda. Sin repetición por tecla mantenida                                                                                |
| Coches             | 5 carriles, sentidos alternos, 2–4 coches por carril, velocidad base 60–130 px/s según carril                                                                        |
| Río                | 5 carriles de troncos (3 celdas) y tortugas (2 celdas), sentidos alternos, velocidad base 50–110 px/s                                                                |
| Arrastre           | Sobre tronco o tortuga la rana se mueve con la plataforma en píxeles; al saltar, se reengancha a la celda más cercana                                                |
| Cronómetro         | 30 s por travesía; se reinicia al ocupar un nenúfar o al perder una vida                                                                                             |
| Nivel              | `1 + nenúfares completados / 5` redondeado hacia abajo, con tope en 8. Cada nivel multiplica todas las velocidades por 1,15 y resta 2 s al cronómetro (suelo 16 s)   |
| Puntuación         | +10 por cada fila nueva alcanzada hacia arriba en la travesía en curso · +50 al ocupar un nenúfar · + `segundos restantes × 20` de bonus · +1000 al ocupar el quinto |
| Vidas              | 3                                                                                                                                                                    |
| Muerte             | Atropello, caer al agua, salir del tablero arrastrada por una plataforma, agotar el cronómetro, o saltar sobre un nenúfar ya ocupado                                 |
| Al perder una vida | La rana vuelve a la orilla de salida, el cronómetro se reinicia, la puntuación y los nenúfares ya ocupados se conservan                                              |
| Fin de nivel       | Al ocupar los cinco nenúfares: se vacían, la rana vuelve a la salida y todo sube de velocidad                                                                        |
| Fin de partida     | Al perder la tercera vida                                                                                                                                            |

La puntuación por fila solo cuenta la **fila más alta alcanzada** en la travesía en curso: bajar y volver a subir no puntúa dos veces. Es lo que impide farmear puntos con `↓` y `↑` en la mediana.

## Plan de implementación

1. **Motor mínimo: tablero y rana.** Crear `lib/engines/ranaria.ts` con el closure en `mount`, el canvas por parámetro, el tablero pintado por filas, la rana en la orilla de salida y el salto de celda con las cuatro flechas. `ACTION_KEYS` escribe en el mismo mapa de teclas que el teclado; `SCROLL_KEYS` con `preventDefault` para las flechas. Sin obstáculos todavía. Prueba manual: `npx tsc --noEmit` pasa sin un solo `any` y la rana recorre las 13 columnas y las 13 filas jugables sin salirse.
2. **Registro.** Añadir `ranaria: () => import("./ranaria").then((m) => m.ranariaEngine)` a `ENGINES` en `lib/engines/index.ts`. Prueba manual: `/juegos/ranaria/jugar` monta el canvas real en vez de la maqueta y `npm run build` deja el motor en su propio chunk diferido.
3. **Carretera.** Añadir los cinco carriles de coches con sentidos alternos, reaparición por el lado contrario y colisión por solape de celda. Prueba manual: un coche atropella a la rana y la devuelve a la salida; el HUD descuenta una vida.
4. **Río.** Añadir los cinco carriles de troncos y tortugas, el arrastre en píxeles y la muerte por agua o por salir del tablero. Prueba manual: la rana viaja sobre un tronco hasta el borde y muere al salir; pisar agua descuenta vida al instante.
5. **Nenúfares y travesía.** Cinco huecos en la fila 0, marcado al ocupar, muerte al repetir hueco, reinicio de la rana a la salida y fin de nivel al completar los cinco. Prueba manual: ocupar los cinco sube el nivel del HUD a 2 y todo se mueve visiblemente más rápido.
6. **Cronómetro en canvas.** Barra de 30 s en la franja inferior, reinicio por travesía y muerte al agotarse, con reducción de 2 s por nivel hasta el suelo de 16 s. Prueba manual: quedarse quieto agota la barra y cuesta una vida; la franja inferior no se solapa con ninguna fila jugable.
7. **Puntuación.** Fila máxima alcanzada, +50 por nenúfar, bonus de tiempo y +1000 por travesía completa, emitiendo `onScore` solo al cambiar. Prueba manual: subir y bajar en la mediana no suma puntos repetidos.
8. **Vidas y fin de partida.** Prueba manual: agotar las tres vidas por atropello, por agua y por tiempo abre el modal con la marca real.
9. **Ficha.** Reescribir `short` y `long` de `ranaria` en `lib/games.ts` mencionando nenúfares, cronómetro y tres vidas. El `id` no se toca. Prueba manual: `/juegos` sigue listando nueve fichas y `/juegos/ranaria` muestra el texto nuevo.
10. **Pausa, fin y reinicio.** Prueba manual: `PAUSA` congela coches, troncos y cronómetro; `REANUDAR` continúa sin saltos; `FIN` abre el modal con lo marcado; `JUGAR DE NUEVO` reinicia con 3 vidas, nivel 1 y puntuación 0; cambiar de pestaña deja la partida pausada.
11. **Controles táctiles.** Prueba manual: en el emulador de móvil aparecen `◀ ▲ ▼ ▶` en el grupo de dirección, los cuatro hacen saltar la rana una celda por pulsación y el grupo de acción queda vacío.
12. **Guardado de la marca.** Prueba manual: jugar con sesión, guardar desde el modal y ver la marca en `/salon?juego=ranaria`.
13. **Repaso final.** `npm run build`, `npm run format:check` y revisión de la consola en `/juegos/ranaria/jugar`. Comprobar que los cuatro motores anteriores se juegan igual.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/ranaria.ts` no contiene ningún `any`.
- [ ] `/juegos/ranaria/jugar` muestra un canvas jugable en el que las cuatro flechas mueven la rana una celda por pulsación.
- [ ] Mantener una flecha pulsada **no** encadena saltos: hace falta soltar y volver a pulsar.
- [ ] Un coche que toca la rana le cuesta una vida y la devuelve a la orilla de salida.
- [ ] Pisar agua sin plataforma cuesta una vida; sobre tronco o tortuga la rana viaja con la plataforma.
- [ ] Salir del tablero arrastrada por una plataforma cuesta una vida.
- [ ] Ocupar un nenúfar suma 50 puntos más `segundos restantes × 20`, lo marca en la franja inferior y devuelve la rana a la salida.
- [ ] Saltar sobre un nenúfar ya ocupado cuesta una vida.
- [ ] Ocupar los cinco nenúfares suma 1000, vacía los cinco huecos y sube el nivel del HUD, con todas las velocidades más altas y el cronómetro más corto.
- [ ] El nivel tiene tope 8 y el cronómetro nunca baja de 16 s.
- [ ] Avanzar a una fila nueva suma 10 puntos; bajar y volver a subir no vuelve a sumar.
- [ ] Agotar el cronómetro cuesta una vida.
- [ ] Perder la tercera vida abre el modal de fin de partida con la puntuación real.
- [ ] El cronómetro y los nenúfares ocupados se pintan **dentro del canvas**, en la franja inferior, y no duplican ningún campo del HUD de la plataforma.
- [ ] La puntuación, las vidas y el nivel del HUD coinciden en todo momento con la partida, y **no** hay ningún HUD de plataforma pintado dentro del canvas.
- [ ] El canvas no muestra overlays de pausa, de fin de partida ni de reinicio.
- [ ] El juego es mudo y no escribe nada en `localStorage`.
- [ ] `PAUSA` congela coches, troncos y cronómetro por completo y `REANUDAR` continúa sin saltos; una pausa larga no consume tiempo del cronómetro.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante y permite guardarla.
- [ ] `JUGAR DE NUEVO` reinicia con 3 vidas, nivel 1, puntuación 0 y los cinco nenúfares vacíos, sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'ranaria'` y aparece en `/salon?juego=ranaria`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] `/juegos` sigue listando nueve fichas y la de Ranaria aparece bajo el filtro ARCADE.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor.
- [ ] A 375 px de ancho el juego se ve completo, sin recortes ni scroll horizontal, y los cuatro botones táctiles caben en una fila.
- [ ] Los reproductores de Asteroides, Caída, Arkanoid y Serpentina pintan exactamente los mismos botones táctiles que antes de esta spec.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola de `/juegos/ranaria/jugar`.
- [ ] `lib/engines/types.ts` y `components/game-player.tsx` no tienen ninguna modificación por esta spec.
- [ ] `supabase/migrations/` no gana ningún archivo por esta spec.
- [ ] `references/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí, y es lo que la separa de su rival `02-ranaria-jugable.md`:** rejilla discreta y cinco nenúfares. La rana ocupa siempre una celda entera y el tablero se resuelve por índices; solo el arrastre sobre plataforma usa píxeles. Es el Frogger que la gente recuerda —la tensión está en elegir el hueco, no en afinar un aterrizaje— y es la variante barata: la colisión es una comparación de celdas y no hay animación de salto que sincronizar. La rival apuesta por simulación continua y orilla libre; aquí se prefiere la lectura arcade nítida y el coste menor.
- **No:** ampliar `GameAction` con un `jump`. Las cuatro direcciones absolutas ya existen desde la SPEC 08 y expresan el juego entero. Tocar el contrato arrastraría `ACTION_FACE` y `STEERING`, y con ellos el mando de los otros cuatro juegos.
- **Sí:** declarar también `down`. Retroceder es parte del juego: permite esperar en la mediana y corregir un salto malo. Sin `down` el jugador queda encajonado contra el tráfico.
- **Sí:** salto discreto sin repetición por tecla mantenida. Es la regla del original y evita que dejar el dedo apoyado cruce el tablero de golpe.
- **Sí:** cronómetro pintado dentro del canvas. El HUD del reproductor solo tiene puntuación, vidas y nivel, y ampliarlo por un juego afectaría a los otros cuatro. La barra vive en la franja inferior del tablero, como parte del arte del juego.
- **No:** usar `onLevel` para el cronómetro. Sería mentir en un campo del HUD que ya significa otra cosa.
- **Sí:** el cronómetro mata. Sin castigo por tiempo el juego se convierte en esperar el hueco perfecto y la partida no acaba nunca.
- **Sí:** tres vidas y `hasLives: true`. El HUD tiene campo de vidas y el juego es de muerte instantánea: encaja sin forzar nada.
- **Sí:** conservar los nenúfares ya ocupados al perder una vida. Reiniciarlos convertiría cada muerte en volver a empezar y haría el nivel 8 inalcanzable.
- **Sí:** bonus de tiempo `segundos restantes × 20`. Premia cruzar rápido y da al marcador un rango parecido al de los otros juegos del catálogo.
- **Sí:** puntuar solo la fila máxima alcanzada por travesía. Cierra el farmeo obvio de subir y bajar en la mediana.
- **Sí:** tortugas como plataformas sólidas con otra velocidad. Las que se sumergen exigen un ciclo de estados y una señal visual clara; son una capa de dificultad, no el núcleo.
- **Sí:** arte con primitivas de canvas. No hay lámina en `references/source-assets/` para este juego y encargarla bloquearía la spec.
- **Sí:** conservar `.cover-rana` tal cual. Ya dibuja carriles y un cuerpo verde: describe el juego que se implementa.
- **Sí:** reutilizar la ficha `ranaria` con su `id` intacto. Renombrarla obligaría a una migración SQL sobre `scores` sin ganar nada.
- **Sí:** reescribir `short` y `long`. Los textos actuales no mencionan vidas ni cronómetro.
- **Sí:** dejar el audio fuera, como en las cinco specs anteriores. El sonido merece una spec transversal a todos los motores.
- **Sí:** acumulador de tiempo con `dt` acotado y bandera `paused` que salta el `update`, en vez de `setInterval`. Es el patrón de los cuatro motores existentes.

## Riesgos

| Riesgo                                                                                    | Mitigación                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| El cronómetro dentro del canvas se lee como un HUD paralelo y contradice el invariante    | Es parte del tablero, en una franja propia que no repite puntuación, vidas ni nivel. Hay criterio de aceptación explícito sobre no duplicar el HUD. |
| El arrastre en píxeles sobre una rejilla discreta descoloca a la rana entre celdas        | Sobre plataforma la rana guarda una `x` continua; al saltar se reengancha a la celda más cercana. El paso 4 lo verifica de borde a borde.           |
| La colisión por celda perdona coches rápidos que atraviesan la celda entre dos fotogramas | Las velocidades tope están acotadas por debajo de una celda por fotograma a 60 fps, y `dt` se acota como en los otros motores.                      |
| Con 8 niveles de multiplicador 1,15 el juego se vuelve injugable                          | 1,15⁷ ≈ 2,66 sobre la velocidad base, con tope de nivel en 8; el paso 5 comprueba la jugabilidad en el último nivel.                                |
| El tablero de 520×600 se ve pequeño en escritorio                                         | `.game-canvas` escala por CSS con `object-fit: contain`, igual que hace con los 300×600 de Caída.                                                   |
| Una pausa larga descuenta cronómetro y mata al reanudar                                   | La bandera `paused` salta el `update` entero, cronómetro incluido. Hay criterio de aceptación para la pausa larga.                                  |
| El Strict Mode monta el efecto dos veces y quedan dos bucles                              | `destroy()` cancela el `rAF` por su id, es idempotente y retira los listeners de teclado.                                                           |
| El bonus de tiempo infla el marcador frente a los juegos ya publicados                    | El bonus máximo por nenúfar es 600 puntos y exige cruzar en cero segundos; el rango de una partida buena queda cerca del de Arkanoid.               |

## Lo que no entra en esta spec

Ni audio, ni sprites, ni portada nueva, ni cocodrilos, ni tortugas que se sumergen, ni mosca de bonus, ni rana acompañante, ni récord local, ni validación de la puntuación en servidor, ni dificultad seleccionable. Tampoco se amplía `GameAction`, ni se toca `components/game-player.tsx`, ni se conectan `best` y `plays` a la base de datos, ni se retira la maqueta de los juegos que siguen sin motor, ni se toca `references/`.
