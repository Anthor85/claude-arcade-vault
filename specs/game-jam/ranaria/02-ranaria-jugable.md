# SPEC GJ-RANARIA-B — Ranaria jugable: travesía continua, orilla libre y sin retroceso

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 08
> **Fecha:** 2026-08-24
> **Tema:** cruzar sin morir
> **Variante:** B de 2 — rival: `01-ranaria-jugable.md`
> **Objetivo:** Escribir desde cero el motor `lib/engines/ranaria.ts` como un Frogger de simulación continua —salto interpolado, colisión por cajas en píxeles, orilla de meta libre en todo su ancho y sin tecla de retroceso— y conectarlo a la ficha `ranaria`, de modo que `/juegos/ranaria/jugar` sea una partida real cuya puntuación se inscribe en el Salón de la Fama.

## Por qué existe esta spec

La plataforma tiene cuatro motores reales: Asteroides (SPEC 05), Caída (SPEC 06), Arkanoid (SPEC 07) y Serpentina (SPEC 08). `ranaria` sigue siendo una ficha de `lib/games.ts` sin motor: entrar en `/juegos/ranaria/jugar` cae en `MockArena`, la maqueta que sube la puntuación sola con un `setInterval`. Se puede guardar en `scores` un número que nadie ha jugado.

Al tema «cruzar sin morir» le aporta la versión más tensa del cruce: aquí la rana **no puede volver atrás**. Cada salto es un compromiso, y la única salida de un carril es el siguiente carril. Es además la mecánica más distinta de las cuatro ya jugables: avance por carriles con obstáculos que atraviesan la pantalla, sin proyectiles ni pelota.

De las dos jugables en rejilla que ya tiene el catálogo (Serpentina y Caída), esta variante se aleja a propósito: el tablero se simula en píxeles, no en celdas. Los troncos arrastran a la rana con su velocidad real, el salto tarda 120 ms en completarse y la colisión es un solape de cajas. Un aterrizaje en el borde de un tronco es un aterrizaje en el borde de un tronco, no un redondeo a la celda más cercana.

No hay port: `references/started-games/` no contiene ningún Frogger. La lógica se escribe entera contra el contrato `GameEngine`.

**No hay desajuste con el contrato.** Las cuatro direcciones absolutas ya existen en `GameAction` desde la SPEC 08, y esta variante solo declara tres de ellas. Esta spec **no** toca `lib/engines/types.ts` ni `ACTION_FACE` / `STEERING` de `components/game-player.tsx`.

Sí hay un indicador que el HUD del reproductor no sabe mostrar: el **cronómetro de la travesía**. El HUD genérico tiene `Puntuación`, `Vidas` y `Nivel`, y ninguno más. Tal y como anota `references/SUGERENCIAS_JUEGOS.MD`, el cronómetro **se pinta dentro del canvas**, en la franja inferior del tablero. Es legal —es parte del arte del juego, no un HUD de plataforma— y queda escrito aquí para que no se confunda.

> **Aviso de versión.** No se introduce ninguna API de Next. El motor se carga con el mismo `import()` dinámico dentro del efecto de `components/game-player.tsx` que ya usan los otros cuatro. Consultar `node_modules/next/dist/docs/` antes de tocar cualquier cosa de routing o data fetching, como exige `AGENTS.md`.

## Alcance

**Dentro:**

- **Motor nuevo** en `lib/engines/ranaria.ts`, que exporta `ranariaEngine: GameEngine`: canvas interno de 640×640 con 16 bandas de 40 px, rana con posición en píxeles y salto interpolado, cinco carriles de coches, cinco carriles de río con troncos y tortugas, orilla de meta libre en todo el ancho, tres vidas y cronómetro por travesía.
- **Salto interpolado** de 120 ms con la rana invulnerable mientras está en el aire sobre agua, y sólida frente a coches durante todo el trayecto.
- **Registro** de `ranaria` en `ENGINES` (`lib/engines/index.ts`), con `import()` diferido.
- **Textos de la ficha** `ranaria` en `lib/games.ts`: `short` y `long` reescritos para describir el juego real (sin retroceso, cronómetro, tres vidas). El `id` no cambia.
- **Cronómetro y contador de travesías** dibujados dentro del canvas, en la franja inferior.
- Ayuda de controles bajo el marco CRT: `↑`, `←` y `→`, con una línea que avise de que no hay marcha atrás.
- Todo el arte con primitivas de canvas, en el lenguaje visual neón de la plataforma.

**Fuera (otra spec si llega):**

- **Audio.** Sin salto, sin chapoteo, sin claxon. Los cuatro motores existentes son mudos; el sonido va en una spec transversal que los cubra a todos a la vez.
- **Sprites y lámina de arte.** No hay material en `references/source-assets/` para este juego.
- **Portada.** `.cover-rana` de `app/globals.css` ya dibuja carriles horizontales y un cuerpo verde: describe el juego y no se toca.
- **Nenúfares como huecos discretos** de meta. En esta variante la orilla superior vale entera; los huecos son de la spec rival.
- Cocodrilos, serpientes, tortugas que se sumergen, mosca de bonus y rana acompañante.
- **Récord local en `localStorage`** y **validación anti-trampas** de la puntuación. Sigue vigente el riesgo asumido en la SPEC 04.
- Dificultad seleccionable. Los valores de esta spec son fijos.
- Conectar `best` y `plays` de `lib/games.ts` a la base de datos.
- Retirar la maqueta de los juegos que aún no tienen motor.
- Realtime en el Salón de la Fama (pendiente desde la SPEC 04).
- Tests automatizados: el proyecto no tiene framework de tests.
- Modificar `references/`. Es material de solo lectura.

## Modelo de datos

No hay tablas nuevas, ni columnas nuevas, **ni migración**. La ficha conserva su `id` (`ranaria`), así que ninguna fila de `scores` cambia de `game_id`.

### Contrato

`lib/engines/types.ts` **no cambia**. El motor declara:

```ts
actions: ["left", "up", "right"];
hasLives: true;
```

`components/game-player.tsx` tampoco cambia: los tres valores ya están en `ACTION_FACE` y en `STEERING` desde la SPEC 08. El mando táctil pinta tres botones en el grupo de dirección y deja vacío el de acción. `components/player.module.css` no cambia: tres botones de 60 px con `gap: 12px` y `padding: 16px` suman 236 px y sobran en 375 px.

### Reglas del juego

| Concepto           | Valor                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Canvas interno     | 640×640 px, 16 bandas horizontales de 40 px; posiciones en píxeles, no en celdas                                                 |
| Bandas             | 0 orilla de meta · 1–5 río · 6 mediana · 7–11 carretera · 12 orilla de salida · 13–15 franja de estado                           |
| Salto              | Interpolado en 120 ms hacia la banda contigua o 40 px en horizontal; durante el salto no se acepta otra entrada                  |
| Sin retroceso      | No existe `down`: la rana solo avanza o se desplaza en horizontal                                                                |
| Coches             | 5 carriles, sentidos alternos, cajas de 56×28 px, velocidad base 70–150 px/s según carril                                        |
| Río                | 5 carriles de troncos (120 px) y tortugas (80 px), sentidos alternos, velocidad base 50–120 px/s                                 |
| Arrastre           | Sobre plataforma la rana suma la velocidad de esa plataforma a su `x` cada fotograma; el salto conserva la `x` de origen         |
| Colisión           | Solape de cajas (AABB) contra coches; en el río, el centro de la rana debe caer dentro de una plataforma al terminar el salto    |
| Cronómetro         | 30 s por travesía; se reinicia al llegar a la orilla de meta o al perder una vida                                                |
| Nivel              | `1 + floor(travesías / 2)`, con tope en 9. Cada nivel multiplica las velocidades por 1,12 y resta 2 s al cronómetro (suelo 16 s) |
| Puntuación         | +10 por banda nueva alcanzada hacia arriba · +100 al llegar a la orilla de meta · + `segundos restantes × 10` de bonus           |
| Vidas              | 3                                                                                                                                |
| Muerte             | Atropello, terminar un salto en agua sin plataforma, salir del tablero arrastrada por una plataforma, o agotar el cronómetro     |
| Al perder una vida | La rana vuelve al centro de la orilla de salida, el cronómetro se reinicia, la puntuación y el nivel se conservan                |
| Fin de travesía    | Al tocar la orilla de meta en cualquier punto de su ancho: la rana vuelve a la salida y el contador de travesías sube            |
| Fin de partida     | Al perder la tercera vida                                                                                                        |

Sin `down`, la única forma de deshacer un salto es sobrevivir al carril en el que se está. La banda 6 (mediana) es el único descanso seguro de la travesía.

## Plan de implementación

1. **Motor mínimo: tablero y salto interpolado.** Crear `lib/engines/ranaria.ts` con el closure en `mount`, el canvas por parámetro, las bandas pintadas, la rana con `x`/`y` en píxeles y el salto de 120 ms con `↑`, `←` y `→`. `ACTION_KEYS` escribe en el mismo mapa de teclas que el teclado; `SCROLL_KEYS` con `preventDefault` para las flechas. Prueba manual: `npx tsc --noEmit` pasa sin un solo `any`, el salto se ve interpolado y pulsar `↓` no hace nada.
2. **Registro.** Añadir `ranaria: () => import("./ranaria").then((m) => m.ranariaEngine)` a `ENGINES` en `lib/engines/index.ts`. Prueba manual: `/juegos/ranaria/jugar` monta el canvas real en vez de la maqueta y `npm run build` deja el motor en su propio chunk diferido.
3. **Carretera y colisión AABB.** Cinco carriles de coches con sentidos alternos, reaparición por el lado contrario y solape de cajas. Prueba manual: la rana muere justo cuando las cajas se tocan, ni antes ni después; el HUD descuenta una vida.
4. **Río y arrastre continuo.** Troncos y tortugas con velocidad propia, arrastre sumado a la `x` de la rana, muerte por aterrizar en agua y por salir del tablero. Prueba manual: la rana viaja sobre un tronco hasta el borde y muere al salir; aterrizar medio cuerpo fuera del tronco pero con el centro dentro es aterrizaje válido.
5. **Orilla de meta y travesías.** Llegar a la banda 0 en cualquier punto cierra la travesía, devuelve la rana a la salida y sube el contador. Prueba manual: dos travesías suben el nivel del HUD a 2 y todo se mueve visiblemente más rápido.
6. **Cronómetro en canvas.** Barra de 30 s en la franja inferior, reinicio por travesía y muerte al agotarse, con reducción de 2 s por nivel hasta el suelo de 16 s. Prueba manual: quedarse quieto agota la barra y cuesta una vida; la franja inferior no se solapa con ninguna banda jugable.
7. **Puntuación.** Banda máxima alcanzada por travesía, +100 por meta y bonus de tiempo, emitiendo `onScore` solo al cambiar. Prueba manual: la puntuación del HUD coincide con la suma esperada tras tres travesías.
8. **Vidas y fin de partida.** Prueba manual: agotar las tres vidas por atropello, por agua y por tiempo abre el modal con la marca real.
9. **Ficha y ayuda de controles.** Reescribir `short` y `long` de `ranaria` en `lib/games.ts` mencionando que no hay marcha atrás, y declarar los `controls` con las tres flechas y esa advertencia. El `id` no se toca. Prueba manual: `/juegos` sigue listando nueve fichas, `/juegos/ranaria` muestra el texto nuevo y bajo el marco CRT se lee la ayuda de tres teclas.
10. **Pausa, fin y reinicio.** Prueba manual: `PAUSA` congela coches, troncos, salto en curso y cronómetro; `REANUDAR` continúa sin saltos; `FIN` abre el modal con lo marcado; `JUGAR DE NUEVO` reinicia con 3 vidas, nivel 1 y puntuación 0; cambiar de pestaña deja la partida pausada.
11. **Controles táctiles.** Prueba manual: en el emulador de móvil aparecen `◀ ▲ ▶` en el grupo de dirección, no aparece ningún `▼` y el grupo de acción queda vacío.
12. **Guardado de la marca.** Prueba manual: jugar con sesión, guardar desde el modal y ver la marca en `/salon?juego=ranaria`.
13. **Repaso final.** `npm run build`, `npm run format:check` y revisión de la consola en `/juegos/ranaria/jugar`. Comprobar que los cuatro motores anteriores se juegan igual.

## Criterios de aceptación

- [ ] `npm run build` y `npm run format:check` terminan sin errores.
- [ ] `npx tsc --noEmit` pasa y `lib/engines/ranaria.ts` no contiene ningún `any`.
- [ ] `/juegos/ranaria/jugar` muestra un canvas jugable en el que `↑`, `←` y `→` mueven la rana con un salto visiblemente interpolado.
- [ ] Pulsar `↓` no produce ningún movimiento y el mando táctil no muestra el botón `▼`.
- [ ] Una entrada recibida durante un salto en curso se ignora: no se encadenan dos saltos con una sola pulsación.
- [ ] Un coche que solapa la caja de la rana le cuesta una vida y la devuelve a la orilla de salida.
- [ ] Terminar un salto en agua sin plataforma bajo el centro de la rana cuesta una vida.
- [ ] Sobre tronco o tortuga la rana se desplaza con la velocidad real de la plataforma, y salir del tablero así cuesta una vida.
- [ ] Llegar a la orilla de meta en cualquier punto de su ancho suma 100 puntos más `segundos restantes × 10` y devuelve la rana a la salida.
- [ ] Cada dos travesías sube el nivel del HUD, con todas las velocidades más altas y el cronómetro más corto.
- [ ] El nivel tiene tope 9 y el cronómetro nunca baja de 16 s.
- [ ] Avanzar a una banda nueva suma 10 puntos, y una banda solo puntúa una vez por travesía.
- [ ] Agotar el cronómetro cuesta una vida.
- [ ] Perder la tercera vida abre el modal de fin de partida con la puntuación real.
- [ ] El cronómetro y el contador de travesías se pintan **dentro del canvas**, en la franja inferior, y no duplican ningún campo del HUD de la plataforma.
- [ ] La puntuación, las vidas y el nivel del HUD coinciden en todo momento con la partida, y **no** hay ningún HUD de plataforma pintado dentro del canvas.
- [ ] El canvas no muestra overlays de pausa, de fin de partida ni de reinicio.
- [ ] El juego es mudo y no escribe nada en `localStorage`.
- [ ] `PAUSA` congela coches, troncos, salto en curso y cronómetro, y `REANUDAR` continúa sin saltos ni teletransportes.
- [ ] Cambiar de pestaña durante una partida la deja pausada al volver.
- [ ] `FIN` abre el modal con la puntuación acumulada hasta ese instante y permite guardarla.
- [ ] `JUGAR DE NUEVO` reinicia con 3 vidas, nivel 1 y puntuación 0, sin recargar la página.
- [ ] `SALIR` desmonta el juego: no queda ningún bucle en marcha ni listener de teclado, y volver a entrar arranca una partida limpia a velocidad normal.
- [ ] Con sesión iniciada, guardar inserta en `scores` una fila con `game_id = 'ranaria'` y aparece en `/salon?juego=ranaria`.
- [ ] Sin sesión, el modal muestra el aviso con enlace a `/acceso` y no inserta nada.
- [ ] `/juegos` sigue listando nueve fichas y la de Ranaria aparece bajo el filtro ARCADE.
- [ ] La ayuda de controles bajo el marco CRT declara las tres flechas y advierte de que no hay marcha atrás.
- [ ] El bundle de `/` y de `/juegos` no incluye el código del motor.
- [ ] A 375 px de ancho el juego se ve completo, cuadrado, sin recortes ni scroll horizontal.
- [ ] Los reproductores de Asteroides, Caída, Arkanoid y Serpentina pintan exactamente los mismos botones táctiles que antes de esta spec.
- [ ] Las flechas y el espacio no desplazan la página mientras se juega.
- [ ] No aparece ningún error de hidratación en la consola de `/juegos/ranaria/jugar`.
- [ ] `lib/engines/types.ts` y `components/game-player.tsx` no tienen ninguna modificación por esta spec.
- [ ] `supabase/migrations/` no gana ningún archivo por esta spec.
- [ ] `references/` no tiene ninguna modificación introducida por esta spec.

## Decisiones tomadas y descartadas

- **Sí, y es lo que la separa de su rival `01-ranaria-jugable.md`:** simulación continua en píxeles con salto interpolado y colisión AABB. La rival resuelve el tablero por índices de celda y redondea el aterrizaje a la celda más cercana; aquí el borde del tronco es el borde del tronco y el arrastre usa la velocidad real de la plataforma. Cuesta más —hay una animación de salto que sincronizar con la lógica y una colisión que afinar— pero da la sensación de riesgo que la rejilla suaviza, y permite carriles a velocidades que no son múltiplos del tamaño de celda.
- **Sí, segundo eje de separación:** orilla de meta libre en todo su ancho, sin nenúfares. La rival hace del hueco correcto el objetivo; aquí el objetivo es simplemente llegar, y la dificultad viene del cronómetro que se acorta y de la velocidad. Simplifica el estado —no hay huecos ocupados que recordar entre vidas— y convierte cada travesía en una unidad de puntuación limpia.
- **Sí, tercer eje de separación:** no declarar `down`. Sin marcha atrás cada salto es irreversible y la travesía se juega hacia delante. Además el mando táctil se queda en tres botones, más cómodos en móvil que cuatro.
- **No:** ampliar `GameAction` con un `jump`. Las direcciones absolutas ya existen desde la SPEC 08 y expresan el juego entero. Tocar el contrato arrastraría `ACTION_FACE` y `STEERING`, y con ellos el mando de los otros cuatro juegos.
- **Sí:** ignorar la entrada durante un salto en curso. Encolarla haría que una ráfaga de pulsaciones cruzara la carretera sin que el jugador viera lo que hacía.
- **Sí:** cronómetro pintado dentro del canvas. El HUD del reproductor solo tiene puntuación, vidas y nivel, y ampliarlo por un juego afectaría a los otros cuatro. La barra vive en la franja inferior del tablero.
- **No:** usar `onLevel` para el cronómetro. Sería mentir en un campo del HUD que ya significa otra cosa.
- **Sí:** el cronómetro mata. Sin castigo por tiempo, sin retroceso y con la mediana como refugio, la partida se convertiría en esperar indefinidamente el hueco perfecto.
- **Sí:** tres vidas y `hasLives: true`. El HUD tiene campo de vidas y el juego es de muerte instantánea.
- **Sí:** nivel cada dos travesías, no cada travesía. Con la orilla libre las travesías caen más rápido que los nenúfares de la rival; subir cada una agotaría el tope de nivel en menos de un minuto.
- **Sí:** bonus de tiempo `segundos restantes × 10`, la mitad que en la rival. Aquí hay más travesías por partida, así que el multiplicador se recorta para que el marcador no se dispare frente a los juegos ya publicados.
- **Sí:** canvas cuadrado de 640×640. `object-fit: contain` lo encaja sin deformarlo y las 16 bandas de 40 px dejan tres para la franja de estado sin comer tablero.
- **Sí:** tortugas como plataformas más cortas y rápidas que los troncos. Las que se sumergen exigen un ciclo de estados y una señal visual clara; son una capa de dificultad, no el núcleo.
- **Sí:** arte con primitivas de canvas. No hay lámina en `references/source-assets/` para este juego y encargarla bloquearía la spec.
- **Sí:** conservar `.cover-rana` tal cual. Ya dibuja carriles y un cuerpo verde: describe el juego que se implementa.
- **Sí:** reutilizar la ficha `ranaria` con su `id` intacto. Renombrarla obligaría a una migración SQL sobre `scores` sin ganar nada.
- **Sí:** reescribir `short` y `long`. Los textos actuales prometen nenúfares, que en esta variante no existen.
- **Sí:** dejar el audio fuera, como en las cinco specs anteriores. El sonido merece una spec transversal a todos los motores.
- **Sí:** acumulador de tiempo con `dt` acotado y bandera `paused` que salta el `update`, en vez de `setInterval`. Es el patrón de los cuatro motores existentes.

## Riesgos

| Riesgo                                                                                 | Mitigación                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| El cronómetro dentro del canvas se lee como un HUD paralelo y contradice el invariante | Es parte del tablero, en una franja propia que no repite puntuación, vidas ni nivel. Hay criterio de aceptación explícito sobre no duplicar HUD. |
| La colisión AABB se percibe injusta cerca del borde de un coche                        | La caja de la rana se define un 20 % menor que su dibujo, el margen clásico del género. El paso 3 lo verifica a ojo, carril por carril.          |
| El salto interpolado desincroniza lógica y dibujo: la rana muere donde no se la ve     | La colisión se evalúa contra la posición interpolada real, no contra el origen ni el destino del salto.                                          |
| Sin `down` el jugador se siente atrapado y abandona la partida                         | La ayuda de controles y el texto de la ficha lo advierten, y la mediana de la banda 6 es un refugio seguro sin límite de carriles.               |
| El arrastre en píxeles deja a la rana a caballo entre dos troncos                      | El aterrizaje válido lo decide el centro de la rana; si no cae dentro de ninguna plataforma, es agua. Regla única y verificable.                 |
| Con 9 niveles de multiplicador 1,12 el juego se vuelve injugable                       | 1,12⁸ ≈ 2,48 sobre la velocidad base, con tope de nivel en 9; el paso 5 comprueba la jugabilidad en el último nivel.                             |
| Una pausa larga descuenta cronómetro o completa un salto congelado                     | La bandera `paused` salta el `update` entero, salto en curso y cronómetro incluidos.                                                             |
| El Strict Mode monta el efecto dos veces y quedan dos bucles                           | `destroy()` cancela el `rAF` por su id, es idempotente y retira los listeners de teclado.                                                        |
| Las travesías rápidas inflan el marcador frente a los juegos ya publicados             | El bonus máximo por travesía es 300 puntos y el cronómetro se acorta con el nivel; el rango de una partida buena queda cerca del de Serpentina.  |

## Lo que no entra en esta spec

Ni audio, ni sprites, ni portada nueva, ni nenúfares, ni cocodrilos, ni tortugas que se sumergen, ni mosca de bonus, ni rana acompañante, ni récord local, ni validación de la puntuación en servidor, ni dificultad seleccionable. Tampoco se amplía `GameAction`, ni se toca `components/game-player.tsx`, ni se conectan `best` y `plays` a la base de datos, ni se retira la maqueta de los juegos que siguen sin motor, ni se toca `references/`.
