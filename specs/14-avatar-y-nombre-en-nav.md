# SPEC 14 — Avatar y nombre en el nav

> **Estado:** Aprobada
> **Depende de:** SPEC 04, SPEC 13
> **Fecha:** 2026-08-26
> **Objetivo:** Mostrar avatar + nombre del jugador a la izquierda del botón de sesión en la vista web (que pasa a decir "Cerrar Sesión"), y en móvil separar ese mismo bloque avatar+nombre del item de menú "Cerrar Sesión".

## Por qué existe esta spec

Hoy `components/nav.tsx` resuelve sesión iniciada con un único control: en web es un botón `USERNAME ▾` que a la vez muestra el nick y dispara el cierre de sesión; en móvil es un único botón `Cerrar Sesión (username)` que hace lo mismo. Ninguno de los dos separa "quién soy" de "salir", y ninguno muestra una imagen del jugador. Desde SPEC 13, el login con Google y GitHub deja en `user.user_metadata.avatar_url` la foto de perfil del proveedor; esta spec la aprovecha sin tocar el esquema de Supabase.

## Alcance

**Dentro:**

- `lib/supabase/session.ts`: `getSessionUser()` añade `avatarUrl` al `SessionUser`, leído de `user.user_metadata.avatar_url` (viene ya en el `user` de `getUser()`, sin consulta adicional).
- `components/session-provider.tsx`: el tipo `SessionUser` gana el campo `avatarUrl: string | null`.
- `components/nav.tsx`, vista web: a la izquierda del botón de sesión aparece un bloque avatar+nombre no clicable; el botón, ahora separado, dice "Cerrar Sesión" (antes mostraba el nick y una `▾`).
- `components/nav.tsx`, panel móvil: una fila de cabecera con avatar+nombre no clicable, y por debajo el item de menú "Cerrar Sesión" ya existente pero sin el nick embebido en su texto.
- Avatar: `<img>` normal (sin `next/image`) con `src={user.avatarUrl}` cuando existe; si es `null` (login por email+contraseña, o el proveedor no trajo foto), un icono arcade genérico fijo, igual para todo el mundo.
- Estilos nuevos en `app/globals.css` siguiendo las clases `av-nav` / `av-mobile-panel` ya existentes (pixel-art, paleta CRT del proyecto).

**Fuera (otra spec si llega):**

- Subir o cambiar avatar a mano (no hay columna `avatar_url` en `profiles` ni pantalla de perfil; sigue fuera de alcance como en SPEC 04 y SPEC 13).
- Página de perfil o cualquier destino al hacer click en avatar+nombre: el bloque es puramente decorativo.
- `next/image` con `remotePatterns` para `googleusercontent.com` / `githubusercontent.com`: se usa `<img>` normal.
- Cambiar el comportamiento de `signOut()` en `session-provider.tsx`: solo cambia dónde y cómo se dispara desde el nav.

## Modelo de datos

No se crean tablas ni migraciones. Se extiende un tipo existente:

- `components/session-provider.tsx` → `SessionUser`: `{ id: string; username: string; avatarUrl: string | null }`.
- `lib/supabase/session.ts` → `getSessionUser()` calcula `avatarUrl` como `user.user_metadata?.avatar_url ?? null` (Google y GitHub usan ambos la clave `avatar_url` en `user_metadata`; un login por email+contraseña no la trae, así que da `null`).

## Plan de implementación

1. **Tipo y lectura de sesión.** Añadir `avatarUrl` a `SessionUser` en `components/session-provider.tsx` y calcularlo en `lib/supabase/session.ts` como se describe arriba. Prueba manual: con una cuenta logueada por Google/GitHub, un `console.log` temporal (o inspección en React DevTools) confirma que `user.avatarUrl` trae una URL; con una cuenta por email+contraseña, confirma `null`.
2. **Bloque avatar+nombre (componente compartido).** Dentro de `components/nav.tsx`, extraer un pequeño bloque JSX (no hace falta archivo aparte) que renderiza `<img src={user.avatarUrl} />` si `avatarUrl` no es `null`, o el icono arcade genérico si lo es. Se reutiliza tal cual en la vista web y en el panel móvil. Prueba manual: visualmente se ve el avatar circular con foto para una cuenta OAuth, e icono genérico para una cuenta por email.
3. **Vista web.** En el bloque `{user ? (...) : (...)}` de `av-nav`, sustituir el botón único `USERNAME ▾` por: bloque avatar+nombre (no clicable) + botón `Cerrar Sesión` (mismas clases `btn ghost auth-btn`, mismo `onClick={leave}`, mismo `disabled={leaving}`). Añadir estilos en `app/globals.css` para el nuevo contenedor y el `<img>`/icono, respetando el `max-width` responsive que ya recorta `.auth-btn` por debajo de 840px. Prueba manual: en escritorio se ve `[avatar] [nombre]` seguido del botón `Cerrar Sesión`; al pulsar el botón cierra sesión igual que antes.
4. **Panel móvil.** En `<aside className="av-mobile-panel">`, añadir la fila de cabecera avatar+nombre (mismo bloque del paso 2) justo antes del item `Cerrar Sesión`, y quitar el nick del texto del botón (queda `Cerrar Sesión` a secas, ya no `Cerrar Sesión (username)`). Prueba manual: al abrir el menú hamburguesa con sesión iniciada se ve la fila con avatar+nombre y, debajo, el item `Cerrar Sesión` que sigue cerrando sesión y cerrando el panel.
5. **Caso sin sesión.** Verificar que las ramas `else` (usuario `null`) de ambos bloques no cambian: siguen mostrando el enlace `Iniciar Sesión` tal cual hoy. Prueba manual: sin sesión, tanto en web como en móvil, solo se ve `Iniciar Sesión`; no aparece avatar ni "Cerrar Sesión".
6. **Verificación final.** `npm run build` sin errores de TypeScript/ESLint; `npm run lint`.

## Criterios de aceptación

- [ ] En vista web, con sesión iniciada por Google o GitHub, aparece la foto de perfil del proveedor a la izquierda de un botón `Cerrar Sesión`.
- [ ] En vista web, con sesión iniciada por email+contraseña, aparece el icono arcade genérico (no una foto) a la izquierda del botón `Cerrar Sesión`.
- [ ] El botón `Cerrar Sesión` en vista web cierra la sesión y redirige/actualiza igual que el botón `USERNAME ▾` hacía antes.
- [ ] En vista web, junto al avatar se lee el `username` de la sesión.
- [ ] En el menú móvil, con sesión iniciada, hay una fila con avatar+nombre y, por separado, un item `Cerrar Sesión` sin el nick en su texto.
- [ ] El item `Cerrar Sesión` del menú móvil cierra sesión y cierra el panel, igual que antes.
- [ ] Sin sesión iniciada, tanto en web como en móvil, no aparece avatar ni botón de cerrar sesión: solo `Iniciar Sesión`, sin cambios respecto al comportamiento actual.
- [ ] El bloque avatar+nombre no es clicable ni navega a ningún sitio.
- [ ] En viewports por debajo de 840px (breakpoint ya usado en `av-nav`), el nav no se desborda ni corta el nombre de forma ilegible.
- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Sí:** avatar = foto del proveedor OAuth (`user_metadata.avatar_url`), sin migración ni columna nueva en `profiles`. Ya viene gratis en la sesión desde SPEC 13; añadir `avatar_url` a `profiles` duplicaría un dato que Supabase ya expone.
- **Sí:** icono arcade genérico fijo como fallback para cuentas email+contraseña (no inicial derivada del username). Mantiene el fallback como un asset estático, sin lógica de color/inicial que mantener.
- **No:** `next/image` con `remotePatterns` para los dominios de Google/GitHub. Un `<img>` normal evita tocar `next.config` por una imagen pequeña y no crítica para rendimiento.
- **Sí:** separar avatar+nombre (decorativo) del botón de acción, tanto en web como en móvil. Un control que a la vez identifica y actúa (el `USERNAME ▾` actual) es menos claro que dos elementos con un solo propósito cada uno.
- **No:** hacer clicable el avatar+nombre. No existe página de perfil en el proyecto (fuera de alcance en SPEC 04 y SPEC 13); un elemento clicable sin destino sería confuso.
- **Sí:** reutilizar el mismo bloque JSX de avatar+nombre en web y móvil en vez de dos implementaciones. Mismo dato, misma regla de fallback; evita que diverjan con el tiempo.
