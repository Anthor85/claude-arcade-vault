"use server";

import { headers } from "next/headers";
import { Resend } from "resend";

/** Lo que el formulario manda al Server Action. */
type ContactInput = {
  name: string;
  email: string;
  msg: string;
  /** Honeypot: siempre vacío en un envío humano. */
  website: string;
};

/** Lo que el Server Action devuelve a `useActionState`. */
export type ContactState =
  | { status: "idle" }
  | { status: "ok"; name: string }
  | { status: "error"; message: string; field?: "name" | "email" | "msg" };

const MAX_NAME = 60;
const MAX_EMAIL = 120;
const MAX_MSG = 2000;

/** Ventana y cupo del límite de frecuencia por IP. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;

/**
 * Marcas de tiempo de los envíos aceptados, por IP. Vive en memoria del
 * proceso: se pierde al reiniciar y no se comparte entre instancias. Es
 * deliberado (ver spec 03); un límite persistente sería otra spec.
 */
const recentSends = new Map<string, number[]>();

/** Formato de email deliberadamente laxo: algo@algo.algo, sin espacios. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readInput(formData: FormData): ContactInput {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    name: get("name"),
    email: get("email"),
    msg: get("msg"),
    website: get("website"),
  };
}

function validate(input: ContactInput): ContactState | null {
  if (!input.name) {
    return {
      status: "error",
      message: "EL NOMBRE ES OBLIGATORIO.",
      field: "name",
    };
  }
  if (input.name.length > MAX_NAME) {
    return {
      status: "error",
      message: `EL NOMBRE NO PUEDE PASAR DE ${MAX_NAME} CARACTERES.`,
      field: "name",
    };
  }
  if (!input.email) {
    return {
      status: "error",
      message: "EL CORREO ES OBLIGATORIO.",
      field: "email",
    };
  }
  if (input.email.length > MAX_EMAIL) {
    return {
      status: "error",
      message: `EL CORREO NO PUEDE PASAR DE ${MAX_EMAIL} CARACTERES.`,
      field: "email",
    };
  }
  if (!EMAIL_RE.test(input.email)) {
    return {
      status: "error",
      message: "EL CORREO NO TIENE UN FORMATO VÁLIDO.",
      field: "email",
    };
  }
  if (!input.msg) {
    return {
      status: "error",
      message: "EL MENSAJE ES OBLIGATORIO.",
      field: "msg",
    };
  }
  if (input.msg.length > MAX_MSG) {
    return {
      status: "error",
      message: `EL MENSAJE NO PUEDE PASAR DE ${MAX_MSG} CARACTERES.`,
      field: "msg",
    };
  }
  return null;
}

/**
 * Clave del límite: primera IP de `x-forwarded-for`. Si el despliegue no manda
 * la cabecera se usa una clave común: limita el conjunto en vez de dejarlo
 * abierto.
 */
async function rateLimitKey(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}

/** Registra el envío y devuelve `false` si la IP ha agotado su cupo. */
function takeSlot(key: string): boolean {
  const now = Date.now();
  const fresh = (recentSends.get(key) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (fresh.length >= RATE_MAX) {
    recentSends.set(key, fresh);
    return false;
  }
  fresh.push(now);
  recentSends.set(key, fresh);
  return true;
}

/**
 * Envía el mensaje del formulario de `/acerca` por email con Resend.
 *
 * Es un endpoint público de facto: revalida todo en servidor aunque el
 * formulario ya valide en cliente.
 */
export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const input = readInput(formData);

  // Honeypot: el bot cree que ha colado, pero no se envía nada.
  if (input.website) {
    return { status: "ok", name: input.name };
  }

  const invalid = validate(input);
  if (invalid) return invalid;

  if (!takeSlot(await rateLimitKey())) {
    return {
      status: "error",
      message: "DEMASIADOS ENVÍOS. INTÉNTALO EN UNOS MINUTOS.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM;
  const to = process.env.CONTACT_TO;

  const failure: ContactState = {
    status: "error",
    message: "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.",
  };

  if (!apiKey || !from || !to) {
    // Sin cuerpo del mensaje en el log: solo qué falta configurar.
    console.error(
      "[contacto] faltan variables de entorno:",
      [
        !apiKey && "RESEND_API_KEY",
        !from && "CONTACT_FROM",
        !to && "CONTACT_TO",
      ]
        .filter(Boolean)
        .join(", "),
    );
    return failure;
  }

  const text = [
    `Nombre: ${input.name}`,
    `Correo: ${input.email}`,
    "",
    input.msg,
  ].join("\n");

  const html = `<p><strong>Nombre:</strong> ${escapeHtml(input.name)}</p>
<p><strong>Correo:</strong> ${escapeHtml(input.email)}</p>
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.msg)}</pre>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: input.email,
      subject: `[Arcade Vault] Mensaje de ${input.name}`,
      text,
      html,
    });

    if (error) {
      console.error(
        "[contacto] Resend devolvió error:",
        error.name,
        error.message,
      );
      return failure;
    }
  } catch (err) {
    console.error(
      "[contacto] fallo al enviar:",
      err instanceof Error ? err.message : err,
    );
    return failure;
  }

  return { status: "ok", name: input.name };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
