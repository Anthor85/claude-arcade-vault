# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — plataforma para jugar online y competir por puntuación. Next.js 16 (App Router) + Supabase. Hay autenticación real, puntuaciones persistentes y Salón de la Fama. Los juegos jugables están reflejados en el archivo .\references\IMPLEMENTED_GAMES.MD

No hay framework de tests configurado. Si se añade uno, documentar aquí cómo ejecutar un test individual.

## Comandos

```bash
npm run dev          # next dev (reescribe el bloque nextjs-agent-rules en AGENTS.md)
npm run build        # next build
npm run start        # next start (requiere build previo)
npm run lint         # eslint (flat config, sin argumentos)
npm run format       # prettier --write .
npm run format:check # prettier --check .
```

## Estructura

- `app/` — rutas: `/` (landing), `/juegos` (biblioteca), `/juegos/[id]` (detalle), `/juegos/[id]/jugar` (reproductor), `/salon` (Salón de la Fama), `/acceso` (login/registro), `/acerca` (about + contacto). Server Actions en `actions.ts` junto a su ruta.
- `components/` — nav, footer, `session-provider`, `game-player` (marco CRT genérico), `hall-of-fame`, `auth-form`, `contact-form`, tarjetas y decoraciones de home.
- `lib/engines/` — motores de juego y su contrato.
- `lib/games.ts` — catálogo (ficha, textos, categoría, color, clase `cover-<slug>`).
- `lib/supabase/` — clientes browser/server, lectura de sesión y tipos.
- `lib/scores-db.ts` — ranking desde la vista `hall_of_fame`.
- `proxy.ts` — refresco de la cookie de sesión (en Next 16 el Middleware se llama **Proxy**; la doc de `@supabase/ssr` sigue diciendo `middleware.ts`).
- `supabase/migrations/` — esquema versionado (`profiles`, `scores`, vista `hall_of_fame`, RLS).
- `specs/` — specs numeradas 01–12, con su estado en la cabecera.
- `references/` — prototipo original y `started-games/` (juegos sueltos pendientes de portar).

## Motores de juego

Todo juego implementa el contrato `GameEngine` de `lib/engines/types.ts` y se registra en `lib/engines/index.ts` con **carga diferida** (`import()`), para que ningún motor viaje en el bundle de otras rutas. Motores actuales: `asteroides`, `caida` (Tetris), `arkanoid`, `serpentina`, `ranaria`.

Invariantes del contrato (están comentados en `types.ts`, respetarlos):

- Importar el módulo no tiene efectos secundarios; todo arranca en `mount`.
- El motor solo pinta en su `<canvas>`: HUD, overlays, pausa y modal de fin son de `components/game-player.tsx`.
- Los listeners los registra `mount` y los quita `destroy`.
- Los eventos (`onScore`, `onLives`, `onLevel`) se emiten al **cambiar** el valor, no por frame.
- Tras `onGameOver` el motor deja de simular hasta un `restart`.

Ampliar `GameAction` obliga a tocar también `ACTION_FACE` y `STEERING` en `components/game-player.tsx`.

## Supabase

- Auth por email + contraseña. **`Confirm email` desactivado** en el panel (no vive en el repo).
- Autorización = políticas RLS; el código de la app no filtra por usuario a mano.
- Usar `getUser()` (valida el token), nunca `getSession()`.
- Solo claves públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Nunca `service_role` en el repo ni en `.env.local` del cliente.
- MCP de Supabase declarado en `.mcp.json` (habilitado en `.claude/settings.local.json`).
- Variables de entorno documentadas en `.env.template`; `.env.local` no se versiona. Resend (`RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`) alimenta el formulario de `/acerca`.

## Stack y convenciones

- **Next.js 16 + React 19, App Router.** Ver AGENTS.md: esta versión tiene breaking changes respecto al conocimiento previo — consultar `node_modules/next/dist/docs/01-app/` antes de escribir código de routing, layouts, data fetching o server actions.
- **Tipos de rutas generados.** Usar `PageProps<...>` / `LayoutProps<...>` como tipos globales (sin import) en lugar de declarar props a mano. Next los genera en `.next/types`, incluidos vía `tsconfig.json`.
- **Tailwind v4** vía `@tailwindcss/postcss`. Sin `tailwind.config`: los tokens se declaran en `app/globals.css` con `@theme inline` sobre variables CSS de `:root`.
- **Estilos:** utilidades de Tailwind + clases globales del tema arcade en `app/globals.css` (`av-*`, `cover-*`) + **CSS Modules** por pantalla (`components/*.module.css`) para lo que es propio de una vista.
- **Tipografías** cargadas con `next/font/google` en `app/layout.tsx`: Press Start 2P (`--font-pixel`), JetBrains Mono y Courier Prime (`--font-mono`).
- **Alias de imports:** `@/*` → raíz del proyecto.
- TypeScript en modo `strict`.
- Código, comentarios y specs **en español**.

## Formato y lint

- **Prettier** (`npm run format`, `npm run format:check`). Config en `.prettierrc`; `prettier-plugin-tailwindcss` ordena las clases. `eslint-config-prettier` va el último en `eslint.config.mjs` para que ESLint no pelee con el formato.
- **Hook `PostToolUse`** en `.claude/settings.json`: tras cada Write/Edit sobre `.ts/.tsx/.js/.jsx/.mjs/.cjs/.md/.mdx` corre `.claude/hooks/format-and-lint.mjs`, que pasa Prettier y `eslint --fix`. Los errores que ESLint no puede autofijar se devuelven como contexto; el hook nunca bloquea el turno.

## Skills

- `/frontend-design` — usar siempre para diseñar interfaces de usuario.
- `/integrar-juego` — skill propia del repo (`.claude/skills/integrar-juego/`). Escribe la spec para integrar un juego nuevo sobre el contrato `GameEngine`, partiendo de una carpeta de `references/started-games/` o de una descripción. No implementa código. Su `plataforma.md` es el mapa de puntos de integración y el catálogo de criterios de aceptación.
- `/spec-impl-game` — skill propia del repo (`.claude/skills/spec-impl-game/`). Implementa una spec de juego aprobada —lleva dentro la lógica de `/spec-impl`, no la invoca— y encadena después los subagentes `skin-designer` y `mobile-porter`, en ese orden, con pausa antes de cada uno.
- `/spec` y `/spec-impl` — de `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Agentes

- **`game-planner`** (`.claude/agents/game-planner.md`) — Decide qué juego añadir: analiza catálogo, motores y contrato `GameEngine`, y propone candidatos razonados; memoria en `references/SUGERENCIAS_JUEGOS.MD`. Va antes de `/integrar-juego`; no escribe specs ni código.
- **`game-jam`** (`.claude/agents/game-jam.md`) — Dado un tema, elige tres juegos que encajen en `GameEngine` y escribe dos specs rivales por juego en `specs/game-jam/<game-id>/`, sin preguntar. No implementa código ni toca el catálogo.
- **`skin-designer`** (`.claude/agents/skin-designer.md`) — Garantiza que un juego dado tenga al menos tres skins (`clasico`, `retro`, `neon`), incluido el mecanismo transversal en `lib/engines/types.ts` y el selector en `components/game-player.tsx`; memoria en `references/GAMES_WITH_THEMES.MD`. Único agente que escribe código; regla dura: una skin solo cambia colores y dibujado, nunca jugabilidad ni puntuación.
- **`mobile-porter`** (`.claude/agents/mobile-porter.md`) — Audita el sitio en un Chrome real a tamaño móvil (checklist fija de responsive) y deja el arreglo como spec numerada en Borrador; memoria en `references/MOBILE_AUDIT.MD`. Sin argumento revisa home y header; con un `id` de juego, su detalle y reproductor. No implementa código.
- **`security-guardian`** (`.claude/agents/security-guardian.md`) — Audita bajo demanda la seguridad de la app y de Supabase (headers, RLS, contraseñas, advisors) contra SPEC 13/15 y el checklist externo; memoria en `references/SECURITY_AUDIT.MD`. Solo lectura: no edita código ni aplica migraciones.

## Flujo de trabajo

Spec Driven Design. Para features nuevas: escribir primero la spec (con `/spec`, o `/integrar-juego` si es un juego), revisarla, cambiar su estado a **Aprobado** a mano —ese cambio lo hace el humano— y luego implementarla con `/spec-impl`. No codificar directamente.

Para un juego nuevo el flujo empieza un paso antes: elegir el juego con el subagente `game-planner` → spec con `/integrar-juego` → aprobar a mano → `/spec-impl` → actualizar `references/IMPLEMENTED_GAMES.MD`.
