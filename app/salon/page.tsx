import { HallOfFame } from "@/components/hall-of-fame";
import { GAMES } from "@/lib/games";
import { getHallOfFame } from "@/lib/scores-db";
import { getSessionUser } from "@/lib/supabase/session";

export default async function SalonPage({ searchParams }: PageProps<"/salon">) {
  const { juego } = await searchParams;

  // Un `?juego=` que no exista cae en el primero, no en un 404: la pantalla
  // sigue teniendo sentido con cualquier URL.
  const gameId = GAMES.find((g) => g.id === juego)?.id ?? GAMES[0].id;

  const user = await getSessionUser();
  const rows = await getHallOfFame(gameId, user?.id);

  return <HallOfFame gameId={gameId} rows={rows} />;
}
