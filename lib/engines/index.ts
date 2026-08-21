import type { GameEngine } from "./types";

type EngineLoader = () => Promise<GameEngine>;

/**
 * `gameId` de `lib/games.ts` → motor. Los juegos que no aparecen aquí usan la
 * maqueta del reproductor.
 *
 * La carga es diferida a propósito: el motor de un juego no debe viajar en el
 * bundle de `/`, `/juegos` ni del resto de reproductores.
 */
const ENGINES: Record<string, EngineLoader> = {
  asteroides: () => import("./asteroids").then((m) => m.asteroidsEngine),
};

/** ¿Este juego tiene un motor real, o toca maqueta? */
export function hasEngine(gameId: string): boolean {
  return gameId in ENGINES;
}

/** Carga el motor del juego, o `undefined` si no hay ninguno registrado. */
export function loadEngine(gameId: string): Promise<GameEngine> | undefined {
  return ENGINES[gameId]?.();
}
