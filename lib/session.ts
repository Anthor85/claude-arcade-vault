/** Nombre de jugador: mayúsculas, sin espacios extra, máx. 10 caracteres. */
export function normalizeName(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 10);
}
