---
name: spec-impl-game
description: Implementa una spec de juego aprobada y, a continuación, encadena skin-designer (tres skins) y mobile-porter (revisión móvil). Orquesta /spec-impl y los dos subagentes; el id del juego se deduce de la spec.
argument-hint: "<NN-spec-juego> [id-juego]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Skill, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — implementar un juego y dejarlo con skins y revisión móvil

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs que existen:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Motores registrados:
!`cat lib/engines/index.ts 2>/dev/null || echo "No existe lib/engines/index.ts"`

---

## Qué hace este comando

Encadena los tres pasos que hoy se dan a mano al meter un juego nuevo, siempre en este
orden y siempre sobre el mismo juego:

1. `/spec-impl <spec>` — el código.
2. Subagente `skin-designer` — las tres skins (`clasico`, `retro`, `neon`).
3. Subagente `mobile-porter` — la revisión responsive, que acaba en una spec nueva.

**Argumentos:** `$ARGUMENTS`. El primero es la spec (`11-ranaria`, `11` o `ranaria`); el
segundo, opcional, fuerza el `id` del juego.

**Idioma:** español, conciso, como el resto del repo.

---

## Reglas transversales

- **Nunca commitear automáticamente**, en ninguna fase. El commit es del humano.
- Los agentes van **secuencialmente, nunca en paralelo**: `skin-designer` escribe código y
  `mobile-porter` lo audita en un Chrome real; lanzarlos a la vez sería auditar la versión
  vieja.
- **Cualquier parada corta la cadena.** Si una fase falla o el usuario interrumpe, di en qué
  punto quedó y cómo reanudar (este mismo comando, o el agente suelto).

---

## Fase 1 — Implementar la spec

Delega **íntegramente** en `/spec-impl` con el primer argumento: invócala con la
herramienta Skill (`skill: "spec-impl"`, `args: <spec>`).

`spec-impl` lleva `disable-model-invocation: true`; si la invocación se rechaza por eso,
lee `~/.claude/skills/spec-impl/SKILL.md` y sigue sus cuatro fases tal cual. **No
reescribas aquí su lógica.** Mandan sus reglas:

- Bloqueo si el estado de la spec no significa «Aprobado».
- Rama `spec-NN-slug`.
- Pausa tras cada paso del plan, esperando revisión del diff.
- No commitea.

Si `/spec-impl` se detiene —estado en Borrador, árbol de trabajo sucio, el usuario corta—,
**para aquí**. No se lanza ningún agente sobre una implementación a medias.

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
