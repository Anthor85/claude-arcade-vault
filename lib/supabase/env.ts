/**
 * Lectura de las variables de Supabase.
 *
 * Se leen una sola vez y se comprueban aquí: un `.env.local` a medias falla con
 * un mensaje que dice qué falta, en vez de con un error opaco dentro del SDK.
 */

export const SUPABASE_URL = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = requireEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.template a .env.local y rellénala (Project Settings → API en Supabase).`,
    );
  }
  return value;
}
