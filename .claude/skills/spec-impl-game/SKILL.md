---
name: spec-impl-game
description: Implementa una spec de juego aprobada y, a continuación, encadena skin-designer (tres skins) y mobile-porter (revisión móvil). Lleva dentro la lógica de /spec-impl; el id del juego se deduce de la spec.
argument-hint: "<NN-spec-juego> [id-juego]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — implementar un juego y dejarlo con skins y revisión móvil

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs que existen:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin fichero de configuración)"`

Motores registrados:
!`cat lib/engines/index.ts 2>/dev/null || echo "No existe lib/engines/index.ts"`

---

## Qué hace este comando

Encadena los tres pasos que hoy se dan a mano al meter un juego nuevo, siempre en este
orden y siempre sobre el mismo juego:

1. **Implementar la spec** — el código. La lógica de `/spec-impl` está escrita aquí abajo
   (fases 1A–1D): se ejecuta directamente, **sin invocar la skill `/spec-impl`**.
2. Subagente `skin-designer` — las tres skins (`clasico`, `retro`, `neon`).
3. Subagente `mobile-porter` — la revisión responsive, que acaba en una spec nueva.

**Argumentos:** `$ARGUMENTS`. El primero es la spec (`11-ranaria`, `11` o `ranaria`); el
segundo, opcional, fuerza el `id` del juego.

**Idioma:** español, conciso, como el resto del repo.

---

## Reglas transversales

- **Nunca commitear automáticamente**, en ninguna fase. Ni por paso ni al final. El commit
  es del humano; solo commitea si te lo pide explícitamente.
- Los agentes van **secuencialmente, nunca en paralelo**: `skin-designer` escribe código y
  `mobile-porter` lo audita en un Chrome real; lanzarlos a la vez sería auditar la versión
  vieja.
- **Cualquier parada corta la cadena.** Si una fase falla o el usuario interrumpe, di en qué
  punto quedó y cómo reanudar (este mismo comando, o el agente suelto).

---

## Fase 1 — Implementar la spec

Sigue las cuatro subfases en orden estricto. **No avances si la anterior no terminó bien.**

### Fase 1A — Identificar la spec

El primer argumento de `$ARGUMENTS` es la spec.

Si no hay primer argumento:

- Lista los ficheros de `specs/` (ya los tienes arriba).
- Pide el nombre exacto de la spec.
- Para y espera respuesta. No continúes.

Si hay primer argumento:

- Búscalo en `specs/`. El usuario puede haber escrito el nombre completo
  (`11-ranaria-jugable`), solo el número (`11`) o solo el slug (`ranaria`). Localiza el
  fichero en cualquiera de esos casos.
- Si no lo encuentras, enseña las specs disponibles y pide que corrija el nombre.
- Si lo encuentras, pasa a la fase 1B.

### Fase 1B — Validar el estado de la spec

Lee el fichero localizado. Busca la línea de estado de la cabecera: la etiqueta suele ser
`**Estado:**` (español) o `**Status:**` (inglés), pero puede estar en cualquier idioma.
Identifícala por posición (línea de estado cerca del inicio) y por la máquina de estados que
la rodea, no por la etiqueta literal.

**Regla absoluta:** solo puedes continuar si el estado **significa «Aprobado»**, sea cual sea
el idioma (`Aprobado`, `Approved`, `Aprovado`, `Approuvé`, `Genehmigt`, `Approvato`, …).

Cualquier otra cosa —Borrador / Draft, En revisión / In review, Implementado / Implemented,
Obsoleto / Obsolete, o un valor irreconocible— significa **parar** y mostrar el mensaje de
error de abajo. Si la línea de estado no aparece o no la entiendes, **no supongas**: para y
pide que aclaren o que actualicen la spec a la redacción canónica.

**Mensaje de error estándar cuando el estado no significa Aprobado:**

```
❌ No puedo implementar esta spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Aprobado".

Para continuar tienes dos opciones:
  1. Si la spec está lista, ábrela y cambia el estado a "Aprobado" a mano.
     Ese cambio lo hace el humano, no el agente.
  2. Si aún necesita trabajo, usa /spec [nombre] para retomarla.
```

No ofrezcas alternativas, no sugieras «puedo empezar igualmente si quieres». El bloqueo es
intencionado. Aquí **se corta la cadena entera**: no se lanza ningún agente.

### Fase 1C — Crear la rama y cambiarse a ella

Con el estado confirmado como `Aprobado`:

0. **Mira antes el árbol de trabajo**, en el `git status --short` del contexto de sesión. Si
   **no está vacío**, para, enseña los cambios pendientes y pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el árbol de trabajo.
   Cambiar de rama se los llevaría. ¿Qué prefieres?
     1. Commitearlos o guardarlos tú, y volver a lanzar el comando  (recomendado)
     2. Continuar igualmente — los cambios viajan a la rama nueva
   ```

   Espera la respuesta. **No hagas stash ni commit por tu cuenta** salvo que te lo pidan. Si
   el árbol está limpio, ve directo al paso 1 sin mencionarlo.

1. Deriva el nombre de rama del nombre completo del fichero de spec, sin extensión. Formato
   `spec-NN-slug`: `11-ranaria-jugable.md` → rama `spec-11-ranaria-jugable`.

2. Lee el flag `AutoCreateBranch` de la **configuración de creación de rama** del contexto de
   sesión. Si el fichero no existe, falta el valor o no lo entiendes → trátalo como `true`
   (por defecto). Solo un `false` explícito (en cualquier capitalización) lo desactiva.

   **Si `AutoCreateBranch` es `true`:** adelante sin preguntar.
   - Si la rama **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: se está retomando trabajo previo. Cámbiate a ella, lee
     `git log --oneline` de la rama y di qué pasos del plan parecen hechos y desde cuál
     propones seguir. Espera confirmación del punto de reanudación antes de tocar nada.
   - En ambos casos: confirma que el cambio de rama fue bien antes de seguir.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git:

   ```
   AutoCreateBranch está en false.
   ¿Creo la rama spec-NN-slug y me cambio a ella? [s/N]
   ```

   - Si dice **sí**: crea/cámbiate igual que en el caso `true`.
   - Si dice **no** o lo deja vacío: **no crees ninguna rama.** Di que implementarás sobre la
     rama actual y pide confirmación explícita para seguir ahí. No improvises.

3. Confirma visualmente que la spec está lista y qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual, si no se creó ninguna)
   Estado: Aprobado   (← el valor real encontrado en la spec)
   ```

4. **Aún no implementes.** Primero enseña el resumen de la spec: **objetivo**, **alcance**,
   **plan de implementación** (los pasos numerados) y **criterios de aceptación**. Identifica
   las secciones por significado, no por el literal del encabezado.

### Fase 1D — Implementar paso a paso

Tras el resumen, di:

```
Voy a implementar la spec siguiendo el plan al pie de la letra.
Pararé después de cada paso para que revises el diff.

¿Empezamos por el Paso 1?
```

Espera confirmación explícita («sí», «adelante», «venga» o equivalente). No empieces sin ella.

Reglas durante toda la implementación:

- **Nunca commitees automáticamente** (regla transversal de arriba).
- **Implementa lo que dice la spec.** Si algo te parece subóptimo, coméntalo como observación
  pero implementa lo acordado. Los cambios de la spec van a la spec, no al código por sorpresa.
- **Ritmo:** implementa un paso → resume qué ficheros tocaste y qué hiciste → di
  `Paso N completado. ¿Revisas el diff y sigo con el Paso N+1?` → espera confirmación.
- **Si aparece una ambigüedad** que la spec no resuelve: para, descríbela exacta, ofrece dos o
  tres opciones concretas, espera decisión. No improvises.
- **Si piden algo fuera del alcance:** recuérdalo, sugiere anotarlo para la siguiente spec, no
  lo implementes en esta rama.

Al terminar el último paso:

```
✅ Todos los pasos del plan están implementados.
```

Los criterios de aceptación se verifican al final, en el cierre; sigue con la Fase 2.

Si esta fase se detiene —estado en Borrador, árbol sucio, el usuario corta—, **para aquí**.
No se lanza ningún agente sobre una implementación a medias.

---

## Fase 2 — Resolver el `id` del juego

1. Si viene segundo argumento, ese es el `id`: valídalo contra `lib/games.ts`.
2. Si no, dedúcelo de la spec recién implementada: las specs de `/integrar-juego` nombran
   la ficha de `lib/games.ts` y la clase `cover-<slug>`. Contrástalo con las claves de
   `lib/engines/index.ts` (contexto de sesión).
3. Enseña el `id` deducido y **pide confirmación** antes de seguir.

Si no lo deduces con seguridad, o el `id` no está registrado en `lib/engines/index.ts`,
pregunta con AskUserQuestion ofreciendo los `id` con motor registrado. **No te lo
inventes.**

---

## Fase 3 — Skins

Pausa: confirma antes de lanzar. Luego `Agent` con `subagent_type: "skin-designer"` y el
`id` como prompt.

Al volver, resume qué skins ya existían y cuáles añadió —escribe código y su memoria en
`references/GAMES_WITH_THEMES.MD`— y recuerda que esos cambios están **sin commitear**.

---

## Fase 4 — Móvil

Pausa: confirma antes de lanzar. Luego `Agent` con `subagent_type: "mobile-porter"` y el
mismo `id`.

Al volver, di qué spec numerada dejó en **Borrador**. Recuerda que este paso **no
implementa**: aprobarla a mano y pasarla por `/spec-impl` es del humano.

---

## Cierre

Resume las tres fases y los siguientes pasos:

```
Siguientes pasos (tuyos, no míos):
  1. Verificar los criterios de aceptación de specs/NN-slug.md uno a uno.
  2. Cambiar su estado a "Implementado".
  3. Commitear la rama spec-NN-slug.
  4. Decidir qué hacer con la spec móvil recién escrita (specs/MM-slug.md, en Borrador).
```
