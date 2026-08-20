# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — plataforma para jugar online y competir por puntuación. Actualmente el repo es el scaffold inicial de Next.js (solo `app/layout.tsx` + `app/page.tsx`); la funcionalidad de arcade aún no existe.

No hay framework de tests configurado. Si se añade uno, documentar aquí cómo ejecutar un test individual.

## Stack y convenciones

- **Next.js 16 + React 19, App Router.** Ver AGENTS.md: esta versión tiene breaking changes respecto al conocimiento previo — consultar `node_modules/next/dist/docs/01-app/` antes de escribir código de routing, layouts, data fetching o server actions.
- **Tipos de rutas generados.** El layout usa `LayoutProps<"/">` como tipo global (sin import). Next genera estos tipos en `.next/types`; están incluidos vía `tsconfig.json`. Usar `PageProps<...>`/`LayoutProps<...>` en lugar de declarar props a mano.
- **Tailwind v4** vía `@tailwindcss/postcss`. Sin `tailwind.config`: los tokens de diseño se declaran en `app/globals.css` con `@theme inline` sobre variables CSS de `:root` (incluye modo oscuro por `prefers-color-scheme`).
- **Alias de imports:** `@/*` → raíz del proyecto.
- TypeScript en modo `strict`.

## Formato y lint

- **Prettier** (`npm run format`, `npm run format:check`). Config en `.prettierrc`; `prettier-plugin-tailwindcss` ordena las clases. `eslint-config-prettier` va el último en `eslint.config.mjs` para que ESLint no pelee con el formato.
- **Hook `PostToolUse`** en `.claude/settings.json`: tras cada Write/Edit sobre `.ts/.tsx/.js/.jsx/.mjs/.cjs/.md/.mdx` corre `.claude/hooks/format-and-lint.mjs`, que pasa Prettier y `eslint --fix`. Los errores que ESLint no puede autofijar se devuelven como contexto; el hook nunca bloquea el turno.

## Skills

Usa siempre /frontend-design para diseñar interfaces de usuario.

## Flujo de trabajo

El proyecto sigue Spec Driven Design usando las skills `/spec` y `/spec-impl` (de `Klerith/fernando-skills`). Para features nuevas, escribir primero la spec con `/spec` y luego implementarla con `/spec-impl` en vez de codificar directamente.
