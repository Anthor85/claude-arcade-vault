import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * Cliente de Supabase para componentes de cliente.
 *
 * Lee y escribe la cookie de sesión del navegador; `createBrowserClient`
 * devuelve siempre la misma instancia, así que llamarlo en cada render no
 * abre conexiones de más.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
