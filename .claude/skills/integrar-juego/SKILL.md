---
name: integrar-juego
description: Escribe la spec para integrar un juego nuevo en Arcade Vault sobre el contrato GameEngine. Parte de una carpeta de references/started-games o de una descripción, y produce specs/NN-<slug>.md en estado Borrador. No implementa código.
argument-hint: "<carpeta de references/started-games o descripción del juego>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*)
---

# /integrar-juego — spec de integración de un juego

## Contexto de sesión

Fecha de hoy (para la cabecera de la spec; no la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Motores ya registrados:
!`cat lib/engines/index.ts 2>/dev/null || echo "No existe lib/engines/index.ts"`

---

## Qué hace esta skill

Produce **la spec** de integración de un juego en la plataforma. **No escribe código.** La
implementación es de `/spec-impl`, como manda `CLAUDE.md`.

El trabajo de plataforma ya está hecho: la SPEC 05 dejó el contrato `GameEngine`
(`lib/engines/types.ts`), el registro diferido (`lib/engines/index.ts`) y un reproductor
genérico (`components/game-player.tsx`) con HUD, pausa, modal de fin de partida, guardado y
mando táctil. Lo que se repite en cada juego nuevo no es el andamiaje: es el **razonamiento
previo** —qué resolución interna usa, qué pinta fuera del canvas y hay que quitarle, qué
acciones declara, dónde no le encaja el contrato, qué ficha del catálogo ocupa y si hay
marcas que migrar—. Esta skill lo convierte en un procedimiento.

Antes de empezar, lee `plataforma.md` (en esta misma carpeta): es el mapa de puntos de
integración, el patrón de port ya validado y el catálogo de criterios de aceptación.

**Idioma:** responde y escribe la spec en español, como las specs que ya existen.

---

## Fase 1 — Identificar el origen

El argumento recibido es: `$ARGUMENTS`

Hay dos orígenes posibles y el flujo cambia según cuál sea:

- **Port.** El argumento señala una carpeta de `references/started-games/`. Acepta el
  nombre completo (`03-claude-tetris`), solo el número (`03`) o solo el slug (`tetris`).
- **Nuevo.** El argumento es una descripción en texto libre de un juego que aún no existe.
  La spec lo especificará desde cero directamente sobre el contrato.

Si `$ARGUMENTS` viene vacío, o no distingues con seguridad entre los dos casos: muestra las
carpetas del contexto de sesión, pregunta y **espera respuesta**. No asumas.

Comprueba también si el juego ya tiene motor en `ENGINES`. Si lo tiene, dilo y pregunta si
la intención es rehacerlo antes de seguir.

---

## Fase 2 — Inventario del juego

**Solo para el origen "port".** Con el origen "nuevo", salta a la Fase 3 y trata la
descripción del usuario como el inventario, preguntando lo que falte.

Lee `index.html`, `game.js` y el `CLAUDE.md` / `README.md` de la carpeta. Extrae, sin
escribir todavía ni una línea de la spec:

- **Resolución interna del canvas** (`<canvas width height>`). No todos son 4:3: Tetris usa
  300×600, Arkanoid 800×600.
- **Teclas y qué hace cada una.** Serán los `actions` y los `controls` del motor.
- **De dónde salen puntuación, vidas y nivel**, y **cuándo termina la partida**.
- **Qué pinta el original fuera de su canvas**: HUD en DOM, overlays de estado, canvas
  secundarios (Tetris tiene `#next-canvas` para la pieza siguiente), su propio `style.css`,
  su carpeta `assets/` (Arkanoid).
- **Estado global, listeners en `window` y arranque automático** del
  `requestAnimationFrame`: es lo que hay que encerrar en el closure de `mount`.
- **Audio.** Queda fuera por defecto, como en la SPEC 05, salvo que el usuario diga otra
  cosa.

Presenta el inventario al usuario en una lista corta antes de continuar.

---

## Fase 3 — Contraste contra el contrato

Lee `lib/engines/types.ts` y compara. **Los desajustes son las decisiones reales de esta
spec**: preséntalos con `AskUserQuestion`, con dos o tres opciones concretas cada uno. Los
conocidos:

- **`GameAction` es una unión cerrada** (`left | right | thrust | fire`). Tetris necesita
  bajar, rotar y soltar; Arkanoid, lanzar. Ampliarla obliga a tocar también `ACTION_FACE` y
  `STEERING` en `components/game-player.tsx`.
- **Juegos sin vidas.** El contrato permite no llamar a `onLives`, pero el HUD pinta el
  campo `Vidas`. Decidir qué muestra en ese caso.
- **Canvas secundario** (pieza siguiente): dibujarlo dentro del canvas principal, o ampliar
  el contrato.
- **Resolución que no es 4:3.** `.game-canvas` usa `object-fit: contain`, así que encaja con
  bandas laterales sin deformarse. Confirmarlo o proponer alternativa.
- **Assets de imagen.** Requieren `public/` y una decisión sobre precargarlos antes de
  `mount`.

Si aparece un desajuste que no está en esta lista, trátalo igual: nómbralo, propón opciones
y espera decisión. No lo resuelvas por tu cuenta.

---

## Fase 4 — Preguntas de plataforma

En bloques de 3 a 5 preguntas, no de una en una:

- **Ficha del catálogo.** ¿Reutiliza una ficha existente de `lib/games.ts` (`caida` encaja
  con Tetris, `bloque-buster` con Arkanoid) o entra una nueva? Si se reutiliza y se renombra
  el `id`, hace falta una migración que actualice el `game_id` de las filas ya guardadas en
  `scores`, como `supabase/migrations/20260821093401_renombrar_rocas_a_asteroides.sql`.
- **Textos y aspecto:** `title`, `short`, `long`, `cat`, `color`, y la clase `cover-<slug>`
  de `app/globals.css`.
- **Controles táctiles:** qué botones aparecen y con qué glifos.
- **Qué queda fuera:** audio, cambios de dificultad, récords locales, anti-trampas,
  realtime… Todo lo que salga en la conversación y se decida aplazar va al apartado
  _Fuera_, para que no se cuele durante la implementación.

---

## Fase 5 — Escribir la spec

Numera el archivo como `specs/NN-<slug>.md` con el siguiente número libre del contexto de
sesión.

**Lee `specs/05-asteroides-jugable.md` antes de escribir**: es el modelo. Misma estructura y
mismo tono:

1. Cabecera en blockquote: `**Estado:** Borrador`, `**Depende de:** SPEC 05` (más las que
   apliquen), `**Fecha:**` la del contexto de sesión, `**Objetivo:**` en una sola frase.
2. **Por qué existe esta spec.** Qué falta hoy y por qué ese código no se puede usar tal
   cual.
3. **Alcance**, con sus dos bloques `Dentro` y `Fuera`.
4. **Modelo de datos.** Tabla `original → port` con los cambios estructurales, los cambios
   del contrato si los hay, y la migración SQL si la hay. Si no hay datos nuevos, dilo
   explícitamente.
5. **Plan de implementación.** Pasos numerados, cada uno commiteable por sí solo y con su
   prueba manual. Genéralo recorriendo la tabla de puntos de integración de `plataforma.md`
   y saltando los que no apliquen.
6. **Criterios de aceptación.** Casillas booleanas; parte del catálogo de `plataforma.md` y
   añade las propias del juego (reglas de puntuación, condición de nivel, fin de partida).
7. **Decisiones tomadas y descartadas**, cada una con su motivo.
8. **Riesgos** en tabla, con su mitigación.
9. **Lo que no entra en esta spec**, como cierre.

Reglas del documento: una idea por frase, nombres concretos con ruta de archivo, sin TODOs,
sin funciones completas en los bloques de código.

---

## Fase 6 — Cierre

No implementes nada. Termina así:

```
✅ Spec escrita en specs/NN-<slug>.md (estado: Borrador)

Siguiente paso:
  1. Revísala y ajusta lo que haga falta.
  2. Cambia el estado a "Aprobado" a mano. Ese cambio lo hace el humano.
  3. Ejecuta /spec-impl NN-<slug> para implementarla.
```
