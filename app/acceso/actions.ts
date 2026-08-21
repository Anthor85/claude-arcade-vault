"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/session";

/** Lo que los Server Actions de acceso devuelven a `useActionState`. */
export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: "username" | "email" | "pass" };

/** Misma regla que el `check` de `public.profiles`. */
const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;

const NICK_OCUPADO = "EL NOMBRE DE JUGADOR YA ESTÁ OCUPADO.";

function read(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Inicia sesión con email y contraseña. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = read(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!email) {
    return {
      status: "error",
      message: "EL CORREO ES OBLIGATORIO.",
      field: "email",
    };
  }
  if (!password) {
    return {
      status: "error",
      message: "LA CONTRASEÑA ES OBLIGATORIA.",
      field: "pass",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // El mensaje es deliberadamente el mismo para email inexistente y
    // contraseña incorrecta: decir cuál de los dos falla revela qué correos
    // tienen cuenta.
    return {
      status: "error",
      message: "CORREO O CONTRASEÑA INCORRECTOS.",
      field: "pass",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** Registra un jugador nuevo: usuario, email y contraseña. */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = normalizeName(read(formData, "username"));
  const email = read(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_RE.test(username)) {
    return {
      status: "error",
      message:
        "EL NOMBRE DE JUGADOR DEBE TENER DE 3 A 10 CARACTERES: LETRAS, NÚMEROS O GUION BAJO.",
      field: "username",
    };
  }
  if (!email) {
    return {
      status: "error",
      message: "EL CORREO ES OBLIGATORIO.",
      field: "email",
    };
  }
  if (!password) {
    return {
      status: "error",
      message: "LA CONTRASEÑA ES OBLIGATORIA.",
      field: "pass",
    };
  }

  const supabase = await createClient();

  // El nick ocupado se detecta aquí para dar un mensaje claro; si dos registros
  // llegan a la vez, el `unique` de la tabla sigue siendo la red de seguridad
  // (ver más abajo).
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken) {
    return { status: "error", message: NICK_OCUPADO, field: "username" };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    // El trigger `handle_new_user` corre dentro de la transacción que crea el
    // usuario: si el `insert` en profiles falla, no queda nada en auth.users,
    // pero Supabase devuelve un error opaco de base de datos.
    const message =
      error.code === "unexpected_failure" ||
      /database error/i.test(error.message)
        ? NICK_OCUPADO
        : traducir(error.message);
    return { status: "error", message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** Los errores de Supabase vienen en inglés; los habituales se traducen. */
function traducir(message: string): string {
  if (/already registered|already been registered/i.test(message)) {
    return "YA HAY UNA CUENTA CON ESE CORREO.";
  }
  if (/password.*at least|should be at least/i.test(message)) {
    return "LA CONTRASEÑA ES DEMASIADO CORTA.";
  }
  if (/invalid.*email|email.*invalid/i.test(message)) {
    return "EL CORREO NO TIENE UN FORMATO VÁLIDO.";
  }
  return "NO SE PUDO CREAR LA CUENTA. INTÉNTALO DE NUEVO.";
}
