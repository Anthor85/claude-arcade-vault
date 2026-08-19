# SPEC 02 — Home: landing en `/` y biblioteca en `/juegos`

> **Estado:** Implementada
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-19
> **Objetivo:** Portar la landing de `references/home-about/home.jsx` a la ruta `/` (hero, rail de juegos y CTA final) moviendo la biblioteca actual a `/juegos`, sin tocar el resto de rutas.

## Por qué existe esta spec

SPEC 01 dejó la biblioteca en `/`, porque el prototipo de aquel momento no tenía landing. La nueva referencia (`references/home-about/`) sí la tiene: `nav.jsx` añade un enlace `Inicio` y el logo apunta a la home, no al listado. Esta spec cubre ese hueco: crea la landing, libera `/` y reubica la biblioteca.

El CSS de la landing **no está** en `app/globals.css` (992 líneas, sin ninguna clase `home-*`). Vive en `references/home-about/styles.css`, bloque `/* ===== HOME PAGE ===== */` (líneas 930-1070). Hay que portarlo.

La versión que se implementa es **recortada**: de las siete secciones de `home.jsx` solo entran hero, juegos disponibles y CTA final.

## Alcance

**Dentro:**

- Nueva `app/page.tsx` = landing, con tres secciones:
  1. **Hero** — eyebrow `▸ INSERTA UNA MONEDA_`, título de tres líneas (`EL ARCADE` / `CLÁSICO ESTÁ` / `DE VUELTA`), subtítulo, dos CTA (`▶ EXPLORAR JUEGOS` → `/juegos`, `✦ CREAR CUENTA` → `/acceso`), indicador `DESLIZA ▼` y las 8 siluetas pixel flotantes decorativas.
  2. **`// 02 · JUEGOS DISPONIBLES AHORA`** — rail de los 6 primeros juegos de `GAMES` en tarjetas mini, más el botón `VER TODOS LOS JUEGOS →`.
  3. **CTA final** — `¿LISTO PARA JUGAR?` + `INSERTAR MONEDA →` (a `/juegos`) + coletilla.
- Nueva ruta `app/juegos/page.tsx` con el contenido que hoy tiene `app/page.tsx` (hero `av-hero` + `<LibraryBrowser />`), sin cambios de comportamiento.
- Nav actualizado: `Inicio` (`/`), `Biblioteca` (`/juegos`), `Salón de la Fama` (`/salon`), en la barra y en el panel móvil. El logo `ARCADE VAULT` lleva a `/`.
- Estilos de la landing en un CSS Module nuevo, `components/home.module.css`.
- Animación de aparición al hacer scroll (`reveal`) para la sección de juegos y la CTA final.

**Fuera de alcance (para futuras specs):**

- La página **Acerca de** (`references/home-about/about.jsx`, con formulario de contacto y terminal de éxito). Va en su propia spec; **el nav no incluye todavía el enlace `Acerca de`**.
- Sección `// 01 ¿POR QUÉ ARCADE VAULT?` (4 tarjetas de features con iconos pixel).
- Banda de estadísticas (`12+ JUEGOS`, `MILES DE PARTIDAS`, `GLOBAL RANKING`).
- Sección `// 03 ACTIVIDAD EN VIVO` (ticker de últimas puntuaciones y top jugadores de hoy).
- Sección `// 04 PRECIOS` + FAQ.
- Redirecciones de compatibilidad desde la antigua URL de la biblioteca. El proyecto no está publicado.
- Migrar el resto de `globals.css` a CSS Modules. Solo la landing usa módulo.
- Cualquier cambio en `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon` y `not-found.tsx` más allá de que el enlace del nav cambie de destino.
- Tests automatizados (el proyecto no tiene framework de tests).

## Modelo de datos

**No se introduce ninguna estructura nueva.** El rail de juegos sale de `GAMES` (`lib/games.ts`, SPEC 01) con `GAMES.slice(0, 6)`, tal como hace la referencia. Los datos inventados que sí habrían necesitado un módulo propio (ticker de actividad, top jugadores, cifras de stats) quedan fuera de alcance.

Todos los textos de la landing son literales en el JSX, copiados de `home.jsx`.

## Plan de implementación

1. **Mover la biblioteca.** Crear `app/juegos/page.tsx` con el contenido actual de `app/page.tsx` (hero `av-hero` + `<LibraryBrowser />`). Prueba manual: `/juegos` renderiza el listado completo y `/juegos/caida` sigue funcionando (no hay colisión entre `page.tsx` y `[id]/page.tsx`).
2. **Estilos.** Crear `components/home.module.css` portando el bloque `HOME PAGE` de `references/home-about/styles.css` **solo** para las clases que se usan: `home`, `homeHero`, `homeHeroInner`, `heroEyebrow`, `homeTitle` (+ `line1/2/3`), `homeSub`, `homeCtas`, `heroScroll`, `homeSilos` (+ `silo`, `s1`…`s8`), `homeSection`, `sectionHead`, `kicker`, `sectionTitle`, `sectionRule`, `miniRail`, `miniCard`, `miniCover`, `miniMeta`, `miniTitle`, `miniCat`, `homeFinal`, `finalTitle`, `finalCta`, `finalTag`, `reveal` (+ `in`), con sus `@keyframes` (`bounce`, `float`) y sus media queries (`1100px`, `600px`). Los nombres pasan de kebab-case a camelCase. Las clases que ya existen en `globals.css` (`btn`, `.btn.xl`, `.btn.lg`, `.btn.magenta`, `.pulse`, `pixel`, `neon-*`, `blink`, `fade-in`, `cover-bg`, `cover-*`) **no se duplican**: se aplican como clases globales junto a las del módulo, y cualquier selector del módulo que las mencione va envuelto en `:global(...)`.
3. **Siluetas.** Crear `components/home-silhouettes.tsx` (server component) con los 8 SVG pixel de `home.jsx`, `aria-hidden="true"`, usando las clases del módulo.
4. **Reveal.** Crear `components/reveal.tsx` (`"use client"`): envoltorio que aplica la clase `reveal` a su contenedor y le añade `in` cuando un `IntersectionObserver` (`threshold: 0.12`) lo intersecta, desobservando después; el observer se desconecta en el retorno del `useEffect`. Prueba manual: la sección de juegos entra con fundido al hacer scroll y no vuelve a animarse al subir.
5. **Rail de juegos.** Crear `components/mini-card.tsx` (server component) que renderiza un `Link` a `/juegos/[id]` con portada (`cover-bg` + `game.cover`), título y categoría.
6. **Landing.** Reescribir `app/page.tsx` como server component: hero + siluetas + sección `// 02` con `GAMES.slice(0, 6)` + CTA final, envolviendo las secciones 2 y 3 en `<Reveal>`. Las CTA son `Link` con clases `btn xl` / `btn lg`, no `button`. Prueba manual: `/` muestra la landing y todos los enlaces navegan al destino correcto.
7. **Nav.** Actualizar `components/nav.tsx`: añadir el enlace `Inicio` antes de `Biblioteca`; `Biblioteca` apunta a `/juegos`; el estado activo pasa a `pathname === "/"` para Inicio y `pathname.startsWith("/juegos")` para Biblioteca. Mismos cambios en el panel móvil. Prueba manual: en `/juegos/caida/jugar` el enlace activo es `Biblioteca`; en `/` es `Inicio`.
8. **Repaso responsive.** Verificar `/` a 1440 px, 1100 px, 600 px y 375 px: el rail pasa de 6 a 3 y a 2 columnas, el título escala con `clamp`, las CTA se apilan y no hay scroll horizontal.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `/` muestra la landing: eyebrow, título de tres líneas, subtítulo, dos botones, indicador `DESLIZA` y siluetas flotantes.
- [ ] `/` **no** muestra el buscador ni la grid de la biblioteca.
- [ ] `/juegos` muestra el hero `ARCADE VAULT` y la biblioteca completa con el mismo comportamiento que antes: 8 tarjetas, el chip `SHOOTER` deja 2, buscar `cai` deja 1, buscar `zzz` muestra `NO HAY RESULTADOS`.
- [ ] `/juegos/caida`, `/juegos/caida/jugar`, `/acceso` y `/salon` siguen respondiendo igual que antes de esta spec.
- [ ] `/juegos/id-inexistente` sigue cayendo en la pantalla 404 arcade.
- [ ] El rail de la home muestra exactamente 6 tarjetas y cada una navega a `/juegos/<id>` del juego correspondiente.
- [ ] `▶ EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` navegan a `/juegos`; `✦ CREAR CUENTA` navega a `/acceso`.
- [ ] Pinchar el logo `ARCADE VAULT` desde cualquier ruta lleva a `/`.
- [ ] El nav muestra `Inicio`, `Biblioteca` y `Salón de la Fama`, en ese orden, en barra y panel móvil. No aparece `Acerca de`.
- [ ] En `/` el enlace activo es `Inicio`; en `/juegos`, `/juegos/caida` y `/juegos/caida/jugar` el activo es `Biblioteca`.
- [ ] Al cargar `/`, la sección de juegos y la CTA final empiezan invisibles y aparecen con fundido al llegar al viewport.
- [ ] Los estilos de la landing salen de `components/home.module.css`; `app/globals.css` no gana ninguna clase `home-*`, `mini-*`, `silo` ni `reveal`.
- [ ] A 375 px de ancho: el rail queda en 2 columnas, las CTA se apilan y `/` no produce scroll horizontal.
- [ ] No aparece ningún error de hidratación en consola en `/`.

## Decisiones tomadas y descartadas

- **Sí:** biblioteca en `/juegos`, con el detalle en `/juegos/[id]`. Jerarquía coherente listado → detalle; el segmento estático y el dinámico conviven sin conflicto en el App Router.
- **No:** biblioteca en `/biblioteca`. Habría dejado el listado y su detalle en ramas de URL distintas.
- **No:** redirección de compatibilidad desde `/` al listado. `/` pasa a ser una página válida y no hay enlaces publicados que preservar.
- **Sí:** landing recortada a hero + juegos + CTA. Se prefiere una home corta y directa a la landing larga del prototipo; lo demás no se descarta, se aplaza.
- **No:** secciones de features, stats, actividad en vivo y precios. Las tres últimas muestran cifras y actividad inventadas; entrarían cuando haya datos reales o en una spec propia.
- **No:** la página `Acerca de` en esta spec. Trae formulario, validación y pantalla de éxito: es otra pantalla, no un apartado de la home.
- **No:** enlace `Acerca de` en el nav apuntando a una ruta inexistente. Un enlace del menú principal que cae en 404 es peor que no tenerlo.
- **Sí:** CSS Module (`components/home.module.css`) en vez de ampliar `globals.css`. Sus clases (`home`, `reveal`, `section-title`) son genéricas y colisionables; el módulo las aísla y evita que `globals.css` siga creciendo.
- **Sí:** las utilidades ya existentes (`btn`, `pixel`, `neon-*`, `cover-*`) se siguen usando como clases globales. Duplicarlas dentro del módulo dividiría el sistema visual en dos fuentes de verdad.
- **Sí:** `app/page.tsx` como server component; solo `Reveal` es cliente. La landing es estática salvo el observer.
- **Sí:** CTA como `Link` con apariencia de botón. La referencia usa `button onClick={navigate}` porque enruta por hash; aquí romperían el prefetch, el botón atrás y abrir en pestaña nueva.
- **Sí:** las siluetas se quedan aunque sean puramente decorativas. Son la mitad del carácter del hero; van con `aria-hidden` y `pointer-events: none`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `app/juegos/page.tsx` junto a `app/juegos/[id]/page.tsx`: dudas sobre precedencia de ruta estática vs dinámica | El segmento estático gana; se verifica en el paso 1 que `/juegos` y `/juegos/caida` resuelven a páginas distintas. Ante cualquier duda, consultar `node_modules/next/dist/docs/01-app/` como exige `AGENTS.md`. |
| Al pasar el CSS a módulo se pierden reglas que dependían de descendencia con clases globales | Cada selector portado se revisa uno a uno contra las líneas 930-1070 de `references/home-about/styles.css`; los que apuntan a clases globales se envuelven en `:global(...)`. |
| Enlaces internos que aún apuntan a `/` esperando la biblioteca (nav, 404, modal de fin de partida, salón) | Antes de cerrar, `grep` de `href="/"` en `app/` y `components/`: los que signifiquen "ir a la biblioteca" pasan a `/juegos`; los que signifiquen "ir al inicio" se quedan. |
| El `IntersectionObserver` deja las secciones invisibles si no se dispara (navegador antiguo, JS deshabilitado) | `Reveal` comprueba que `IntersectionObserver` exista; si no, aplica `in` de inmediato. |
| Las animaciones `float`, `bounce` y `pulse` molestan a usuarios sensibles al movimiento | Envolver las animaciones del módulo en `@media (prefers-reduced-motion: no-preference)`. |

## Lo que **no** entra en esta spec

- La página `Acerca de` y su formulario de contacto.
- Secciones de features, estadísticas, actividad en vivo y precios/FAQ.
- Datos reales de actividad o ranking global.
- Redirecciones de compatibilidad.
- Migración del resto del CSS a módulos o a utilidades Tailwind.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
