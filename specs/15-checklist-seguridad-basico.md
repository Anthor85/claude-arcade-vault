# SPEC 15 — Checklist de seguridad básico

> **Estado:** Implementada
> **Depende de:** SPEC 04
> **Fecha:** 2026-08-26
> **Objetivo:** Aplicar el checklist de seguridad básico de `references/security/security-checklist.md`: headers de seguridad en Next.js, una regex de complejidad de contraseña (minúsculas + mayúsculas + dígitos + símbolos) en el formulario de registro, y los ajustes del panel de Supabase sobre contraseñas y límite de registros, dejando constancia de que RLS ya está activo en `profiles` y `scores`.

## Por qué existe esta spec

`references/security/security-checklist.md` llegó como un checklist externo (parece un volcado de un escáner/advisor) con puntos pendientes, incluido uno —RLS en `profiles` y `scores`— que ya está resuelto desde SPEC 04. Esta spec cierra la brecha entre ese checklist y el estado real del proyecto: confirma lo que ya está hecho, implementa lo que es código (headers), y documenta como paso operativo lo que solo existe en el panel de Supabase.

## Alcance

**Dentro:**

- `next.config.ts`: función `headers()` que aplica `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` a todas las rutas (`source: '/(.*)'`), tal como en el ejemplo del checklist.
- Protección de rutas con middleware Next.js. Información: https://nextjs.org/docs/app/getting-started/proxy
Ejemplo (proxy.ts):
```
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
}
```
- `app/acceso/actions.ts` y `components/auth-form.tsx`: regex `PASSWORD_RE` que exige al menos una minúscula, una mayúscula, un dígito y un símbolo, aplicada en `signUp` (servidor, fuente de verdad) y como feedback inmediato en el input de contraseña del formulario de registro (cliente). Mismo patrón que `USERNAME_RE` en `actions.ts`.
- Documentar en esta spec, como pasos operativos sobre el panel de Supabase (Authentication → Policies / Rate Limits), sin cambios en el repo:
  - Minimum password length = 8.
  - Leaked password protection = activada.
  - Max signup rate = valor por defecto de Supabase (30/hora), solo se confirma que sigue activo.
- Confirmar (sin migración, ya cumplido desde SPEC 04) que RLS sigue habilitado en `public.profiles` y `public.scores`, y que `get_advisors` (security) no reporta ningún lint de RLS sobre esas tablas.

**Fuera (otra spec si llega):**

- Tocar la función `public.rls_auto_enable()` que `get_advisors` reporta como ejecutable por `anon`/`authenticated` (WARN). Se deja como riesgo aceptado y documentado, sin `REVOKE EXECUTE` en esta spec.
- `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy` u otros headers no listados en el checklist.
- Cualquier cambio de esquema en `profiles` o `scores`.
- Automatizar la verificación de los ajustes del panel de Supabase (password length, leaked password protection, rate limit) vía Management API: se comprueban a mano en el panel.
- Activar el preset nativo de Supabase "Lowercase, uppercase letters, digits and symbols" en Authentication → Policies → Password Requirements. La complejidad se exige solo desde la regex del código; el ajuste del panel se deja como está.
- Aplicar `PASSWORD_RE` en el formulario de inicio de sesión (`signIn`): una cuenta ya creada con una contraseña que no cumpliera la regla antigua debe poder seguir entrando; la regla nueva solo bloquea altas.

## Modelo de datos

Esta spec no introduce estructuras de datos nuevas. Reutiliza `profiles` y `scores` de SPEC 04 sin modificarlos. Añade una constante de validación en código, mismo patrón que `USERNAME_RE`:

```ts
// app/acceso/actions.ts
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
```

## Plan de implementación

1. **Headers en `next.config.ts`.** Añadir un `headers()` asíncrono que devuelve el array `securityHeaders` (los 3 del checklist) aplicado a `source: '/(.*)'`. Prueba manual: `npm run dev`, y en la pestaña Network del navegador comprobar que la respuesta de `/` incluye `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` con los valores indicados.
2. **Regex de complejidad en `signUp` (servidor).** En `app/acceso/actions.ts`, añadir `PASSWORD_RE` y validarla en `signUp` justo después de la comprobación de contraseña vacía, devolviendo `{ status: "error", field: "pass", message: "LA CONTRASEÑA DEBE TENER MAYÚSCULAS, MINÚSCULAS, NÚMEROS Y SÍMBOLOS." }` si no cumple. No se toca `signIn`. Prueba manual: intentar crear una cuenta con `abcdefgh` (sin mayúscula/dígito/símbolo) y comprobar que el servidor la rechaza con ese mensaje.
3. **Feedback en cliente (`auth-form.tsx`).** En el input de contraseña, solo cuando `isSignUp` es `true`, mostrar una pista bajo el campo (mismo estilo que el resto de campos) indicando la regla; no se bloquea el envío en cliente, la fuente de verdad sigue siendo el paso 2. Prueba manual: en la pestaña "Crear cuenta" se ve la pista de complejidad bajo el campo de contraseña; en "Iniciar sesión" no aparece.
4. **Panel de Supabase — longitud mínima de contraseña (paso operativo, sin código).** En Authentication → Policies (Auth settings), fijar _Minimum password length_ en 8. Prueba manual: intentar registrar una cuenta nueva con una contraseña de 7 caracteres desde `/acceso` y comprobar que Supabase la rechaza.
5. **Panel de Supabase — leaked password protection (paso operativo, sin código).** Activar la protección contra contraseñas filtradas (HaveIBeenPwned) en Authentication → Policies. Prueba manual: intentar registrar con una contraseña conocida y filtrada que también cumpla `PASSWORD_RE` (p. ej. `Password123!`) y comprobar que Supabase la rechaza.
6. **Panel de Supabase — max signup rate (paso operativo, sin código).** Confirmar en Authentication → Rate Limits → Sign ups que el límite por IP sigue en su valor por defecto (30/hora) y no ha sido desactivado. No requiere cambio si ya está en el valor de fábrica.
7. **Verificación con `get_advisors`.** Ejecutar `get_advisors` (security) y comprobar que `auth_leaked_password_protection` ya no aparece en la lista. Confirmar que `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` (sobre `rls_auto_enable`) siguen apareciendo — es el riesgo aceptado de esta spec, no un fallo de esta verificación.
8. **Protección de rutas con Proxy Next.js**
9. **Verificación final.** `npm run build` sin errores; `npm run lint`.

## Criterios de aceptación

- [ ] La respuesta HTTP de cualquier ruta de la app incluye los headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Registrar una cuenta nueva con una contraseña que no tenga mayúscula, minúscula, dígito o símbolo es rechazado en el servidor con el mensaje de complejidad, sin llegar a llamar a `supabase.auth.signUp`.
- [ ] Registrar una cuenta nueva con una contraseña que cumple los 4 tipos de carácter y tiene 8+ caracteres (p. ej. `Player123!`) se acepta.
- [ ] En la pestaña "Crear cuenta" del formulario se ve la pista de la regla de complejidad bajo el campo de contraseña; en "Iniciar sesión" no aparece y una cuenta existente puede seguir entrando aunque su contraseña no cumpla la regla nueva.
- [ ] Registrar una cuenta nueva con contraseña de menos de 8 caracteres es rechazado por Supabase.
- [ ] Registrar una cuenta nueva con una contraseña filtrada conocida es rechazado por Supabase.
- [ ] El límite de registros por IP (Authentication → Rate Limits → Sign ups) está activo en el panel, en su valor por defecto.
- [ ] `get_advisors` (security) ya no reporta `auth_leaked_password_protection`.
- [ ] `get_advisors` (security) confirma que `profiles` y `scores` no tienen ningún lint de RLS pendiente (ya cumplido desde SPEC 04, sin cambios en esta spec).
- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Sí:** los 3 headers exactos del checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), sin añadir `HSTS` ni `Permissions-Policy`. Cubren clickjacking/MIME-sniffing/referrer sin decisiones adicionales sobre qué APIs del navegador restringir.
- **No:** revocar `EXECUTE` en `public.rls_auto_enable()` para `anon`/`authenticated`. Se deja fuera de esta spec pese a que `get_advisors` la reporta; queda como riesgo documentado en vez de arreglo (decisión explícita del usuario).
- **Sí:** los tres ajustes de Auth (password length, leaked password protection, signup rate) se documentan como pasos operativos sobre el panel de Supabase, no como código. Mismo patrón que "Confirm email" (SPEC 04) y los providers OAuth (SPEC 13): esta clase de configuración no vive en el repo.
- **Sí:** max signup rate se deja en el valor por defecto de Supabase (30/hora) en vez de un número más estricto. No hay indicio de ataque de bots que justifique un límite más agresivo.
- **No:** tocar RLS en `profiles`/`scores` — ya está activo desde SPEC 04 (`alter table ... enable row level security`, migración `20260820113417_perfiles_y_puntuaciones.sql`). Esta spec solo lo confirma vía `get_advisors`.
- **Sí:** regex de complejidad exigiendo al menos 1 minúscula, 1 mayúscula, 1 dígito y 1 símbolo, sin mínimos por tipo más estrictos. Cubre las 4 clases de carácter pedidas sin una regla difícil de comunicar en el mensaje de error.
- **Sí:** validar en servidor (`signUp`, fuente de verdad) y mostrar una pista en cliente sin bloquear el envío ahí. Mismo patrón que `USERNAME_RE`: la validación real vive en el servidor, el cliente solo orienta.
- **No:** aplicar la regla a `signIn`. Una cuenta creada antes de esta spec (o por email+contraseña sin cumplir la regla nueva) debe poder seguir entrando; la regla solo bloquea altas nuevas.
- **No:** activar el preset "Lowercase, uppercase letters, digits and symbols" de Authentication → Policies → Password Requirements en el panel de Supabase. Decisión explícita del usuario: la complejidad se exige solo desde la regex del código, no se duplica en el panel.

## Riesgos

| Riesgo                                                                                                                              | Mitigación                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.rls_auto_enable()` sigue siendo ejecutable por `anon`/`authenticated` vía RPC tras esta spec                                | Riesgo aceptado explícitamente (ver Decisiones); si se quiere cerrar, requiere una spec propia con `REVOKE EXECUTE`, mismo patrón que se usó con `handle_new_user()` en SPEC 04. |
| Los ajustes del panel de Supabase (pasos 2-4) no viven en el repo y no se replican automáticamente en un proyecto de Supabase nuevo | Igual riesgo que "Confirm email" y los providers OAuth: documentado en esta spec para poder repetirlo a mano.                                                                    |

## Lo que **no** está en esta spec

- Revocar `EXECUTE` en `public.rls_auto_enable()` (otra spec si se decide cerrar ese WARN).
- `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- Cambios de esquema en `profiles` o `scores`.
- Automatización vía Management API de los ajustes de Auth del panel de Supabase.

Cada uno de esos, si llega, va en su propia spec.
