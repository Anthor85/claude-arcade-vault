# Auditoría de seguridad

Memoria del agente `security-guardian`. Referencia: SPEC 13, SPEC 15 y
`references/security/security-checklist.md`.

## Histórico de auditorías

| Fecha | Veredicto general | Cambios desde la anterior |
| ----- | ----------------- | ------------------------- |
| 2026-08-26 | Aceptable, con un hallazgo pendiente | Primera auditoría registrada. `get_advisors` (security) muestra 3 lints: los 2 esperados de `rls_auto_enable()` (riesgo aceptado) y `auth_leaked_password_protection` (WARN) todavía activo — SPEC 15 documentaba este ajuste como paso operativo pendiente de aplicar en el panel y su criterio de aceptación ("`get_advisors` ya no reporta `auth_leaked_password_protection`") no se cumple todavía. Headers de `next.config.ts`, `PASSWORD_RE`/`USERNAME_RE` de `app/acceso/actions.ts`, pista de cliente en `auth-form.tsx`, `proxy.ts` (solo refresco + redirect en `/acceso`) y callback OAuth (`app/auth/callback/route.ts`) verificados contra SPEC 13/15, todos conformes. RLS activo y con las políticas esperadas en `profiles` y `scores`. `handle_new_user()` sigue con `EXECUTE` revocado de `anon`/`authenticated`/`public` tras la migración de SPEC 13 (`20260826070434_username_oauth_fallback`), que la recrea sin restaurar esos grants. |

## Riesgos aceptados (no perseguir)

| Riesgo                                                           | Origen  | Decisión                                                |
| ---------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| `public.rls_auto_enable()` ejecutable por `anon`/`authenticated` | SPEC 15 | Aceptado explícitamente por el usuario; no se persigue. |

## Hallazgos nuevos pendientes de spec

- **`auth_leaked_password_protection` sigue en WARN (2026-08-26).** SPEC 15 lo trataba como paso operativo de panel (Authentication → Policies) y su criterio de aceptación exigía que `get_advisors` dejara de reportarlo; a día de hoy sigue apareciendo, es decir, o no se activó en el panel o se desactivó después. No es un riesgo aceptado (SPEC 15 no lo marca como tal, al contrario que `rls_auto_enable()`): requiere revisar el panel de Supabase (Authentication → Policies → Leaked password protection) y, si sigue sin poder activarse, valorar una spec de seguimiento.
