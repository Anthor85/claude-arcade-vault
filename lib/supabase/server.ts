import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * Cliente de Supabase para server components y Server Actions.
 *
 * Hay que crear uno nuevo en cada render: el cliente lleva dentro las cookies
 * de *esta* petición y compartirlo entre peticiones mezclaría sesiones.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Renderizando un server component: Next no deja escribir cookies
          // ahí. No pasa nada, el proxy ya refrescó la sesión antes de llegar.
        }
      },
    },
  });
}
