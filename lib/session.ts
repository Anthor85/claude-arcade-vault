export type User = { name: string };

export type SavedScore = {
  game: string;
  name: string;
  score: number;
  at: number;
};

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

/** Nombre de jugador: mayúsculas, sin espacios extra, máx. 10 caracteres. */
export function normalizeName(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 10);
}

export function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as User).name === "string"
    ) {
      return { name: (parsed as User).name };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeUser(user: User): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage no disponible: la sesión vive solo en memoria.
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // sin persistencia, nada que limpiar
  }
}

export function readScores(): SavedScore[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SavedScore =>
        !!s &&
        typeof s === "object" &&
        typeof s.game === "string" &&
        typeof s.name === "string" &&
        typeof s.score === "number" &&
        typeof s.at === "number",
    );
  } catch {
    return [];
  }
}

export function writeScores(scores: SavedScore[]): void {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    // sin persistencia: la puntuación se pierde al recargar
  }
}
