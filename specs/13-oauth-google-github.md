# SPEC 13 — Login OAuth con Google y GitHub

> **Estado:** Implementado
> **Depende de:** SPEC 04
> **Fecha:** 2026-08-26
> **Objetivo:** Habilitar los botones `GOOGLE` y `GITHUB` de `/acceso`, hoy `disabled`, para que el jugador pueda entrar con esas cuentas y reciba un perfil con `username` válido generado automáticamente.

## Por qué existe esta spec

SPEC 04 dejó los botones `GOOGLE` y `GITHUB` de `components/auth-form.tsx` visibles pero `disabled` con `title="Próximamente"`, y lo justificó así en sus decisiones: _"OAuth con Google/GitHub ahora. Exige registrar apps y URLs de callback fuera del repo"_. El registro de esas apps ya se puede resolver por configuración de panel (igual que "Confirm email"), y el otro obstáculo señalado en esa spec —que ni GitHub ni Google garantizan un `username` que cumpla `^[A-Z0-9_]{3,10}$`— tiene una solución determinista dentro del propio trigger SQL. Esta spec cierra ambos huecos y activa los botones.

## Alcance

**Dentro:**

- Migración SQL que actualiza la función `handle_new_user()` (creada en SPEC 04) para derivar y sanear un `username` cuando `raw_user_meta_data ->> 'username'` no viene informado (caso de login OAuth), en vez de fallar el `insert` en `profiles`.
- Ruta `app/auth/callback/route.ts` que intercambia el `code` de OAuth por una sesión (`exchangeCodeForSession`) y redirige a `/`.
- Acción para disparar `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` para `google` y `github` desde `/acceso`.
- Activar los botones `GOOGLE` y `GITHUB` en `components/auth-form.tsx`: quitar `disabled` y `title="Próximamente"`, conectarlos a la acción anterior.
- Documentar en esta spec el paso operativo (fuera de código): activar los providers Google y GitHub en el panel de Supabase (Authentication → Providers) con su Client ID/Secret, y registrar la Authorized redirect URI (`<url-del-proyecto>/auth/callback` más la URL de callback propia de Supabase) en Google Cloud Console y en la OAuth App de GitHub.

**Fuera (otra spec si llega):**

- Pantalla de onboarding para elegir el `username` a mano tras un login OAuth. Se descarta a favor de generarlo automáticamente.
- Gestión de identidades vinculadas (desvincular Google/GitHub de una cuenta, ver qué proveedores tiene un usuario).
- Otros proveedores OAuth (Discord, Twitter, etc.).
- Cambios en RLS o en las tablas `profiles`/`scores` más allá de la función del trigger: la autorización ya cubre estas tablas desde SPEC 04 y no cambia con OAuth.
- Página de perfil, cambio de `username` después del registro y borrado de cuenta (ya fuera de alcance en SPEC 04, sigue igual).

## Modelo de datos

No se crean tablas nuevas. Una migración (`supabase/migrations/<timestamp>_username_oauth_fallback.sql`) reemplaza `public.handle_new_user()`:

- Si `raw_user_meta_data ->> 'username'` existe (caso email+contraseña de SPEC 04), se comporta igual que hoy.
- Si no existe (caso OAuth), deriva una base así:
  - GitHub: `raw_user_meta_data ->> 'user_name'` (el login de GitHub).
  - Google: `raw_user_meta_data ->> 'name'` o, si falta, `raw_user_meta_data ->> 'full_name'`.
  - Se pasa a mayúsculas y se eliminan todos los caracteres fuera de `[A-Z0-9_]`, truncando a 10.
  - Si el resultado tiene menos de 3 caracteres, se rellena con `X` hasta llegar a 3 (p. ej. `AB` → `ABX`).
- Con la base ya válida contra `^[A-Z0-9_]{3,10}$`, se comprueba si ya existe en `profiles.username`. Si colisiona, se añade un sufijo numérico incremental (recortando la base si hace falta para no superar 10 caracteres) hasta encontrar uno libre: `PLAYER`, `PLAYER2`, `PLAYER3`, …
- El `username` final resultante siempre cumple la constraint `username_formato` ya existente; no se relaja ninguna constraint de SPEC 04.

No se modifican `scores`, la vista `hall_of_fame` ni las políticas RLS: siguen igual que en SPEC 04.

## Plan de implementación

1. **Migración del trigger.** Escribir `supabase/migrations/<timestamp>_username_oauth_fallback.sql` con la nueva versión de `handle_new_user()` (saneo + relleno + colisión con sufijo numérico, `security definer`, `set search_path = ''` igual que la original). Aplicarla con `apply_migration`. Prueba manual: `execute_sql` insertando manualmente en `auth.users` una fila con `raw_user_meta_data` tipo `{"user_name": "ab"}` (simulando GitHub) y otra con `{"name": "José Pérez"}` (simulando Google) y comprobar en `profiles` que el `username` resultante cumple el formato y no colisiona entre sí.
2. **Ruta de callback.** Crear `app/auth/callback/route.ts` (`GET`) que lea `code` de la query, llame a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor (`lib/supabase/server.ts`) y redirija a `/`. Si no hay `code` o falla el intercambio, redirigir a `/acceso` con un aviso de error. Prueba manual: iniciar el flujo OAuth completo con una cuenta de prueba y comprobar que vuelve autenticado a `/` sin quedarse en la pantalla de callback.
3. **Disparo del login OAuth.** Añadir en `app/acceso/actions.ts` (o directamente en `components/auth-form.tsx` vía cliente de navegador, lo que encaje mejor con `useActionState` existente) la llamada a `supabase.auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: "<origin>/auth/callback" } })`. Prueba manual: pulsar cada botón lleva a la pantalla de consentimiento del proveedor correcto (Google o GitHub, no cruzados).
4. **Activar los botones.** En `components/auth-form.tsx`, quitar `disabled` y `title="Próximamente"` de los botones `GOOGLE` y `GITHUB`, conectarlos al paso 3, conservando las clases `btn ghost`/`.social` ya existentes. Prueba manual: visualmente los botones se ven habilitados (sin la opacidad/estado disabled) y responden al hover/click.
5. **Configuración del panel de Supabase (paso operativo, sin código).** Activar los providers `Google` y `GitHub` en Authentication → Providers, con su Client ID/Secret dados de alta en Google Cloud Console y en una OAuth App de GitHub respectivamente, apuntando ambos a la Authorized redirect URI de Supabase para este proyecto. Documentar aquí que este paso no vive en el repo y hay que repetirlo en cualquier proyecto de Supabase nuevo. Prueba manual: con los providers activados, el flujo completo de los pasos 2–4 funciona de extremo a extremo.

## Criterios de aceptación

- [ ] Los botones `GOOGLE` y `GITHUB` en `/acceso` están habilitados y disparan el flujo de consentimiento del proveedor correspondiente.
- [ ] Completar el login con una cuenta de GitHub nueva crea una fila en `profiles` con un `username` que cumple `^[A-Z0-9_]{3,10}$`.
- [ ] Completar el login con una cuenta de Google nueva crea una fila en `profiles` con un `username` que cumple `^[A-Z0-9_]{3,10}$`.
- [ ] Dos cuentas OAuth que generarían la misma base de `username` terminan con `username` distintos (sufijo numérico), sin que falle el `insert`.
- [ ] Iniciar sesión con Google o GitHub usando el mismo email que una cuenta ya registrada por email+contraseña no crea un perfil duplicado.
- [ ] Tras un login OAuth exitoso, la aplicación redirige a `/` y el nav muestra el `username` de la sesión.
- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `get_advisors` (`security`) no reporta problemas nuevos tras la migración del trigger.

## Decisiones tomadas y descartadas

- **Sí:** habilitar Google y GitHub a la vez. Coincide con los dos botones que ya existen en el UI desde la referencia original; no tiene sentido dejar uno a medias.
- **Sí:** derivar y sanear el `username` automáticamente en el trigger SQL, sin pantalla de onboarding. Mantiene el registro OAuth en un solo paso, igual de directo que "jugar como invitado"; una pantalla intermedia añadiría fricción que el usuario no pidió.
- **No:** pedir el `username` a mano tras el primer login OAuth. Exigiría relajar la constraint `not null` de `profiles.username` y añadir una pantalla nueva con su propio estado intermedio (usuario autenticado pero sin perfil completo) que complica el resto de la app (nav, guardado de puntuación).
- **Sí:** relleno con `X` y colisión resuelta con sufijo numérico incremental, ambos en SQL. Es determinista, no depende de que el cliente reintente nada, y reutiliza la misma constraint ya validada en SPEC 04.
- **Sí:** redirect final a `/`, igual que `signIn`/`signUp` de SPEC 04. Mantiene un único comportamiento post-login en toda la app.
- **Sí:** confiar en el auto-linking por defecto de Supabase cuando el email de la cuenta OAuth coincide con una cuenta existente. Añadir lógica propia de vinculación duplicaría algo que Supabase ya resuelve, y esta spec no pretende cambiar el modelo de identidades.
- **Sí:** credenciales de los providers (Client ID/Secret) solo en el panel de Supabase, sin nuevas variables de entorno en el repo. Sigue el mismo principio que SPEC 04: "toda la seguridad recae en RLS", y una clave de OAuth filtrada en el repo sería un vector de abuso.
- **No:** añadir nuevos providers OAuth (Discord, Twitter, etc.) en esta spec. Los botones existentes en el UI son solo Google y GitHub; añadir más exigiría rediseñar `auth-form.tsx`.

## Riesgos

| Riesgo                                                                                                                                                                            | Mitigación                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El panel de Supabase no tiene los providers configurados antes de desplegar esto, y los botones habilitados fallan en producción                                                  | El paso 5 del plan de implementación es explícito y se verifica con la prueba manual de extremo a extremo antes de dar la spec por completa.                                                     |
| `raw_user_meta_data` trae un campo distinto al esperado según cambios futuros en la API de Google/GitHub, y el saneo produce un `username` vacío                                  | El relleno con `X` hasta 3 caracteres cubre el caso de cadena vacía o demasiado corta; el `check` de la tabla (`username_formato`) sigue siendo la última red, igual que en SPEC 04.             |
| Un `username` derivado automáticamente no le gusta al jugador (p. ej. `JOSPER2` en vez de su nombre real)                                                                         | Aceptado: no hay pantalla de perfil para cambiarlo en esta spec (queda fuera, como en SPEC 04). Es una experiencia peor que elegirlo a mano, pero evita el paso de onboarding descartado arriba. |
| La función `handle_new_user()` con la lógica de colisión hace una consulta a `profiles` por cada intento de sufijo, lo que en teoría podría iterar mucho si hay muchas colisiones | En la práctica el espacio de `username`s de 3-10 caracteres alfanuméricos es enorme comparado con el volumen de usuarios esperado; no se pone límite explícito de reintentos en esta spec.       |
