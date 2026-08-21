import { createClient } from "@/lib/supabase/server";

/** Fila del Salón de la Fama tal y como la pinta la pantalla. */
export type HallRow = {
  rank: number;
  username: string;
  score: number;
  /** dd/mm/aaaa, mismo formato que las filas mock que sustituye. */
  date: string;
  /** true si la fila es del usuario que mira la página. */
  isMine: boolean;
};

/** Cuántas marcas entran en la tabla. */
const LIMIT = 12;

/**
 * Ranking de un juego: la mejor marca de cada jugador, de mayor a menor.
 *
 * Lee la vista `hall_of_fame`, que ya reduce el historial de `scores` a una
 * fila por jugador y juego.
 */
export async function getHallOfFame(
  gameId: string,
  userId?: string | null,
  limit = LIMIT,
): Promise<HallRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hall_of_fame")
    .select("user_id, username, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[salón] no se pudo leer el ranking:", error.message);
    return [];
  }

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    username: row.username ?? "—",
    score: row.score ?? 0,
    date: formatDate(row.created_at),
    isMine: !!userId && row.user_id === userId,
  }));
}

/** dd/mm/aaaa. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}
