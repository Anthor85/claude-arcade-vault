import { createClient } from "./server";
import type { SessionUser } from "@/components/session-provider";

/**
 * El jugador de la petición actual, con su nick de `profiles`.
 *
 * Usa `getUser()`, no `getSession()`: el primero valida el token contra
 * Supabase, el segundo se fía de la cookie.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  // Sin perfil no hay nada que mostrar en el nav ni a quién atribuir marcas.
  if (!profile) return null;

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return { id: user.id, username: profile.username, avatarUrl };
}
