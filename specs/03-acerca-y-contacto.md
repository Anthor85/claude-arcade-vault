# SPEC 03 — Acerca de: página `/acerca` y envío de contacto con Resend

> **Estado:** Aceptada
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-20
> **Objetivo:** Portar `references/home-about/about.jsx` a la ruta `/acerca` y hacer que su formulario de contacto envíe un email real mediante Resend desde un Server Action, añadiendo el enlace `Acerca de` al nav.

## Por qué existe esta spec

SPEC 02 dejó la página **Acerca de** explícitamente fuera de alcance ("trae formulario, validación y pantalla de éxito: es otra pantalla, no un apartado de la home") y, en consecuencia, **no** añadió el enlace `Acerca de` al nav aunque la referencia (`references/home-about/nav.jsx`, líneas 20 y 41) sí lo tiene. Esta spec cierra ese hueco.

Además va un paso más allá que el prototipo: en `about.jsx` el envío es **falso** (`setSent(form.name)` pinta la terminal sin salir del navegador). Aquí el mensaje sale de verdad por Resend.

Es la primera vez que el proyecto tiene código de servidor con efectos externos: hasta ahora todo eran server components estáticos y estado en cliente. Con esto entran una dependencia nueva (`resend`), un Server Action y variables de entorno.

El CSS de la página **no está** en `app/globals.css`: vive en `references/home-about/styles.css`, bloque `/* ===== ABOUT PAGE ===== */` (líneas 1071-1146). Hay que portarlo, igual que se hizo con la home.

## Alcance

**Dentro:**

- Nueva ruta `app/acerca/page.tsx` (server component) con las tres partes de `about.jsx`:
  1. **Hero** — kicker `▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión y la fila de 3 _highlights_ (`HECHO CON ❤️ PARA JUGADORES` magenta, `JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR` cian, `PROYECTO EN CONSTANTE CRECIMIENTO` verde) con sus iconos pixel SVG.
  2. **Banda divisoria** — dos barras en degradado y 24 píxeles parpadeantes con retardo escalonado, decorativa (`aria-hidden`).
  3. **Contacto** — rejilla de dos columnas: intro (kicker `▸ CONTACTO`, título `CONTÁCTANOS`, subtítulo y los 3 _tips_ con LED) y el formulario.
- **Formulario de contacto real.** Campos `NOMBRE`, `CORREO ELECTRÓNICO`, `MENSAJE`, botón `▶ ENVIAR MENSAJE`. Validación de cliente con el `shake` del prototipo, estado de envío, error visible y terminal de éxito `VAULT-OS`.
- **Server Action `sendContactMessage`** en `app/acerca/actions.ts` que revalida los datos y envía el email con Resend.
- **Antispam:** campo trampa (_honeypot_) oculto y límite de frecuencia por IP en memoria.
- **Configuración por entorno:** `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`, con `.env.template` versionado y `.env.local` ignorado por git.
- Estilos en un CSS Module nuevo, `components/about.module.css`.
- Nav actualizado: enlace `Acerca de` → `/acerca`, después de `Salón de la Fama`, en la barra y en el panel móvil.
- Animación `reveal` al hacer scroll para la banda divisoria y la sección de contacto, reutilizando `components/reveal.tsx`.

**Fuera de alcance (para futuras specs):**

- Guardar los mensajes en base de datos o en disco. El email es el único destino.
- Email de confirmación al remitente. Solo se avisa al equipo.
- Plantillas HTML elaboradas con React Email. El correo va en texto plano + un HTML mínimo.
- Adjuntos, captcha (hCaptcha/Turnstile) y límite de frecuencia persistente (Redis/KV). El límite es en memoria y por instancia.
- Panel de administración o bandeja de mensajes dentro de la app.
- Verificación de dominio propio en Resend. Se documenta cómo, pero el valor de `CONTACT_FROM` lo pone quien despliegue.
- Cualquier otro uso de Resend (avisos de puntuación, recuperación de contraseña, boletín).
- Que el formulario funcione sin JavaScript.
- Cambios en `/`, `/juegos`, `/juegos/[id]`, `/acceso`, `/salon` y `not-found.tsx` más allá del enlace nuevo del nav.
- Tests automatizados (el proyecto no tiene framework de tests).

## Modelo de datos

No hay persistencia, pero sí estructuras nuevas en el servidor. Todas viven en `app/acerca/actions.ts`:

```ts
/** Lo que el formulario manda al Server Action. */
type ContactInput = {
  name: string;
  email: string;
  msg: string;
  /** Honeypot: siempre vacío en un envío humano. */
  website: string;
};

/** Lo que el Server Action devuelve a `useActionState`. */
type ContactState =
  | { status: "idle" }
  | { status: "ok"; name: string }
  | { status: "error"; message: string; field?: "name" | "email" | "msg" };
```

Límites de validación en servidor: `name` 1-60 caracteres, `email` 1-120 y con formato válido, `msg` 1-2000. Todos se recortan con `trim()` antes de validar.

Límite de frecuencia: `Map<string, number[]>` en memoria del módulo, clave = IP del cabecero `x-forwarded-for` (primera entrada) y valor = marcas de tiempo de los envíos aceptados. Máximo **3 envíos por IP cada 10 minutos**; las marcas fuera de ventana se descartan en cada llamada.

Los textos de la página (misión, highlights, tips, líneas de la terminal) son literales en el JSX, copiados de `about.jsx`.

## Plan de implementación

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.template` con `RESEND_API_KEY=`, `CONTACT_FROM=onboarding@resend.dev`, `CONTACT_TO=` y un comentario recordando que `onboarding@resend.dev` solo entrega al email de la cuenta de Resend hasta verificar dominio propio. Verificar que `.gitignore` cubre `.env*.local` (el scaffold de Next ya lo trae) y crear `.env.local` localmente sin versionarlo. Prueba manual: `npm run build` sigue pasando.
2. **Estilos.** Crear `components/about.module.css` portando las líneas 1071-1146 de `references/home-about/styles.css` para las clases que se usan: `about`, `aboutHero`, `kicker`, `aboutTitle`, `aboutMission`, `highlightRow`, `highlight` (+ `cyan`, `magenta`, `green`), `hlIcon`, `hlText`, `aboutDivider`, `divBar`, `divPixels`, `aboutContact`, `contactGrid`, `contactIntro`, `contactTitle`, `contactSub`, `contactTips`, `tip`, `tipLed` (+ `y`, `m`), `contactForm` (+ `shake`), `terminalSuccess`, `termBar`, `dot` (+ `r`, `y`, `g`), `termTitle`, `termBody`, `line`, `prompt`, `dim`, `success`, `caret`, más `formError`, con los `@keyframes` propios (`shake`, `pxblink`) y las media queries (`820px`, `900px`). Los nombres pasan de kebab-case a camelCase. Las clases que ya existen en `globals.css` (`btn`, `.btn.xl`, `.btn.ghost`, `press`, `pixel`, `mono`, `neon-*`, `blink`, `fade-in`, `field`) **no se duplican**: se aplican como clases globales y cualquier selector del módulo que las mencione va envuelto en `:global(...)`. Las animaciones van dentro de `@media (prefers-reduced-motion: no-preference)`, como en `home.module.css`.
3. **Iconos.** Crear `components/highlight-icons.tsx` (server component) con los tres SVG pixel (`HEART`, `BROWSER`, `PLANT`) de `about.jsx`, `aria-hidden="true"` y la clase `hlIcon` del módulo.
4. **Server Action.** Crear `app/acerca/actions.ts` con `"use server"` y `sendContactMessage(prev: ContactState, formData: FormData): Promise<ContactState>`:
   - Lee y recorta `name`, `email`, `msg`, `website`.
   - Si `website` no está vacío, devuelve `{ status: "ok" }` sin enviar nada (el bot cree que ha colado).
   - Valida longitudes y formato de email; si falla devuelve `{ status: "error", message, field }`.
   - Aplica el límite por IP; si se supera devuelve un error con mensaje `DEMASIADOS ENVÍOS. INTÉNTALO EN UNOS MINUTOS.`.
   - Instancia `new Resend(process.env.RESEND_API_KEY)` y llama a `resend.emails.send({ from: CONTACT_FROM, to: CONTACT_TO, replyTo: email, subject: \`[Arcade Vault] Mensaje de ${name}\`, text, html })`.
   - Si faltan variables de entorno o Resend devuelve error, registra el fallo en el servidor (sin el cuerpo del mensaje) y devuelve `{ status: "error", message: "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO." }`.
   - Si va bien, devuelve `{ status: "ok", name }`.

   Antes de escribirlo, consultar `node_modules/next/dist/docs/01-app/` sobre Server Actions y lectura de cabeceras, como exige `AGENTS.md`.

5. **Formulario.** Crear `components/contact-form.tsx` (`"use client"`) con `useActionState(sendContactMessage, { status: "idle" })` y `useFormStatus` (o el `pending` que devuelva `useActionState`) para el estado de envío:
   - Campos controlados como en el prototipo, más el honeypot (`name="website"`, oculto, `tabIndex={-1}`, `autoComplete="off"`).
   - Validación de cliente previa: si algún campo está vacío, activa `shake` 400 ms y no envía.
   - Mientras se envía: botón deshabilitado con texto `▶ ENVIANDO…`.
   - Si el estado es `error`: mensaje visible sobre el botón, los campos conservan lo escrito y se puede reintentar.
   - Si el estado es `ok`: terminal `VAULT-OS` con el nombre en mayúsculas y el botón `ENVIAR OTRO MENSAJE`, que limpia el formulario y vuelve al estado inicial.

   Prueba manual: enviar con un campo vacío → shake sin llamada al servidor; enviar completo con la API key puesta → llega el correo a `CONTACT_TO` y aparece la terminal; enviar con `RESEND_API_KEY` inválida → mensaje de error y los datos siguen en el formulario.

6. **Página.** Crear `app/acerca/page.tsx` como server component: hero + highlights + banda divisoria + sección de contacto con `<ContactForm />`, envolviendo divisoria y contacto en `<Reveal>`. Añadir `export const metadata` con título y descripción de la página. Prueba manual: `/acerca` renderiza las tres partes y la divisoria y el contacto aparecen con fundido al bajar.
7. **Nav.** Actualizar `components/nav.tsx`: enlace `Acerca de` → `/acerca` tras `Salón de la Fama`, en la barra y en el panel móvil, con estado activo `pathname.startsWith("/acerca")`. Prueba manual: en `/acerca` el enlace activo es `Acerca de` y ninguno de los otros.
8. **Repaso responsive.** Verificar `/acerca` a 1440 px, 900 px, 820 px y 375 px: los highlights pasan de 3 a 1 columna (820 px), la rejilla de contacto pasa a 1 columna (900 px), la terminal no desborda y no hay scroll horizontal.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `/acerca` muestra kicker `▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión y los 3 highlights con sus iconos y colores (magenta, cian, verde).
- [ ] `/acerca` muestra la banda divisoria con 24 píxeles parpadeantes y la sección de contacto con los 3 tips con LED.
- [ ] Enviar el formulario con cualquier campo vacío produce el `shake` y **no** dispara ninguna petición al servidor.
- [ ] Con las tres variables de entorno configuradas, un envío válido entrega un email a `CONTACT_TO` cuyo asunto contiene el nombre del remitente y cuyo `reply-to` es el email introducido.
- [ ] Tras un envío correcto aparece la terminal `VAULT-OS` con el nombre en mayúsculas; `ENVIAR OTRO MENSAJE` devuelve al formulario con los campos vacíos.
- [ ] Mientras se envía, el botón está deshabilitado y muestra `▶ ENVIANDO…`; no se puede enviar dos veces seguidas con un doble clic.
- [ ] Si `RESEND_API_KEY` falta o es inválida, la página muestra un mensaje de error, conserva lo escrito y **no** muestra la terminal de éxito.
- [ ] Un envío con el campo honeypot relleno no genera ningún email.
- [ ] El cuarto envío desde la misma IP dentro de 10 minutos se rechaza con el mensaje de exceso de envíos.
- [ ] `RESEND_API_KEY` no aparece en ningún bundle de cliente ni en el HTML servido (`grep` sobre `.next/static`).
- [ ] `.env.template` está versionado con las tres claves y sin valores reales; `.env.local` no está en git.
- [ ] El nav muestra `Inicio`, `Biblioteca`, `Salón de la Fama` y `Acerca de`, en ese orden, en barra y panel móvil; en `/acerca` el activo es `Acerca de`.
- [ ] Los estilos salen de `components/about.module.css`; `app/globals.css` no gana ninguna clase `about-*`, `contact-*`, `term-*`, `highlight` ni `tip`.
- [ ] A 375 px de ancho: highlights y rejilla de contacto en una columna y `/acerca` no produce scroll horizontal.
- [ ] `/`, `/juegos`, `/juegos/caida`, `/juegos/caida/jugar`, `/acceso` y `/salon` siguen respondiendo igual que antes de esta spec.
- [ ] No aparece ningún error de hidratación en consola en `/acerca`.

## Decisiones tomadas y descartadas

- **Sí:** ruta `/acerca`. Coherente con `/juegos`, `/acceso` y `/salon`, todas en español.
- **No:** `/about`. Habría dejado el único slug en inglés del proyecto.
- **Sí:** Server Action en `app/acerca/actions.ts`. La API key nunca sale del servidor y no queda un endpoint público que terceros puedan golpear directamente.
- **No:** Route Handler `POST /api/contacto`. Más cómodo de probar con `curl`, pero expone una superficie pública que habría que proteger igualmente.
- **Sí:** `RESEND_API_KEY`, `CONTACT_FROM` y `CONTACT_TO` por entorno, con `.env.template` versionado. Verificar un dominio propio en Resend no debe obligar a tocar código.
- **No:** remitente `onboarding@resend.dev` hardcodeado. Es solo el valor de ejemplo del `.env.template`.
- **No:** email de confirmación al remitente. Duplica coste, plantillas y modos de fallo por poco valor en esta fase.
- **Sí:** validación también en servidor, además del `shake` de cliente. El Server Action es invocable desde fuera del formulario: confiar en la validación de cliente no es validar.
- **Sí:** honeypot + límite de 3 envíos por IP cada 10 minutos. Es lo barato que frena el spam automático sin pedir nada al usuario.
- **No:** captcha. Añade un servicio externo y fricción para un formulario de contacto de un proyecto pequeño.
- **No:** límite de frecuencia persistente. Un `Map` en memoria se pierde al reiniciar y no se comparte entre instancias; es suficiente aquí y cambiarlo por Redis/KV es una spec propia si llega.
- **Sí:** estado de envío y error visibles. Un formulario que siempre dice "enviado" pierde mensajes en silencio.
- **Sí:** CSS Module `components/about.module.css`. Misma decisión que SPEC 02: sus clases (`about`, `tip`, `line`, `prompt`) son genéricas y colisionables.
- **Sí:** reutilizar `components/reveal.tsx` tal cual, aunque sus clases vengan de `home.module.css`. `reveal`/`in` son un fundido genérico; duplicarlo en el módulo nuevo partiría la animación en dos fuentes.
- **Sí:** `.kicker` se define en `about.module.css` en vez de importarse de `home.module.css`. Cruzar clases entre módulos acopla dos páginas por un detalle tipográfico.
- **No:** funcionamiento sin JavaScript. El `shake`, el estado de envío y la terminal necesitan JS de todos modos; el resto de la página sí se renderiza en servidor.
- **No:** guardar los mensajes. No hay base de datos en el proyecto y añadir una es otra spec.
- **No:** plantillas con React Email. Texto plano más un HTML mínimo cubre un aviso interno.

## Riesgos

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin dominio verificado, Resend solo entrega desde `onboarding@resend.dev` al email de la cuenta: en pruebas parece que "no llega"       | `.env.template` lo advierte en un comentario y el criterio de aceptación del envío se verifica con esa combinación.                                      |
| La API key se filtra al cliente por importar `actions.ts` desde un componente sin `"use server"` bien colocado                          | La directiva va en la primera línea del fichero y el criterio de aceptación incluye un `grep` sobre `.next/static`.                                      |
| El Server Action puede invocarse fuera del formulario con datos arbitrarios                                                             | Toda la validación se repite en servidor y hay límite por IP; el honeypot solo filtra bots ingenuos, no es la defensa principal.                         |
| `x-forwarded-for` ausente o falsificable según el despliegue: el límite por IP se puede saltar                                          | Se acepta como mitigación parcial. Si no hay IP, se usa una clave común `unknown`, que limita el conjunto en vez de dejarlo abierto.                     |
| Al pasar el CSS a módulo se pierden reglas que dependían de descendencia con clases globales (`.contact-form textarea`, `.field input`) | Cada selector portado se revisa uno a uno contra las líneas 1071-1146 de `styles.css`; los que apuntan a clases globales se envuelven en `:global(...)`. |
| `resend` es la primera dependencia de servidor del proyecto y podría acabar en el bundle de cliente                                     | Solo se importa en `app/acerca/actions.ts`, que es código de servidor; ningún componente cliente la importa.                                             |
| Las animaciones `shake`, `pxblink` y `blink` molestan a usuarios sensibles al movimiento                                                | Envolver las animaciones del módulo en `@media (prefers-reduced-motion: no-preference)`, como en `home.module.css`.                                      |

## Lo que **no** entra en esta spec

- Persistencia de los mensajes y panel de administración.
- Email de confirmación al remitente y plantillas con React Email.
- Captcha y límite de frecuencia compartido entre instancias.
- Verificación del dominio en Resend y cualquier otro envío de correo de la plataforma.
- Funcionamiento del formulario sin JavaScript.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
