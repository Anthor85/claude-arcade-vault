"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** Lo que el reproductor recibe de `useActionState` al guardar. */
export type SaveScoreState =
  | { status: "idle" }
  | { status: "ok"; score: number }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/**
 * Inscribe una puntuación en `scores`.
 *
 * Sin sesión no se toca la base de datos: se devuelve `unauthenticated` y la
 * pantalla invita a entrar. Con sesión, el `user_id` sale del token del
 * servidor —nunca del formulario—, así que RLS y el dato coinciden siempre.
 *
 * Ojo (riesgo asumido en la spec): la puntuación llega del cliente y no se
 * valida. Cualquiera puede inscribir el número que quiera llamando a este
 * Server Action; lo único garantizado es a quién se atribuye la marca.
 */
export async function saveScore(
  _prev: SaveScoreState,
  formData: FormData,
): Promise<SaveScoreState> {
  const gameId = String(formData.get("gameId") ?? "");
  const score = Number(formData.get("score"));

  if (!gameId || !Number.isInteger(score) || score < 0) {
    return { status: "error", message: "PUNTUACIÓN NO VÁLIDA." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "unauthenticated" };

  const { error } = await supabase
    .from("scores")
    .insert({ user_id: user.id, game_id: gameId, score });

  if (error) {
    console.error("[puntuación] no se pudo guardar:", error.message);
    return {
      status: "error",
      message: "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.",
    };
  }

  revalidatePath("/salon");

  return { status: "ok", score };
}
